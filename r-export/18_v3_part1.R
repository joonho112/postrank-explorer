# Author: JoonHo Lee (jlee296@ua.edu).
# Golden values for the Part 1 engine supplement (engine/API.md "v3 helpers: Part 1 supplement (Step 3.27)").
#   oracle-v3p1  base R only; postrank is not loaded. The ten new functions (pairDifference, normalCoverage, withinBand,
#                sharedMeanPosterior, claimsByDistance, finiteLawCells, binomialMcse, maxCoefficientError, chainCountLaw,
#                runningMean) with throw rows for their checks; the extensions disclosure (withheld), leastCertainPairs
#                (order -> apart), intervalOverlapTally (amount, nested, nestedCount), majorityWins (cycleTriples) and
#                formatProb (open: the AM-07 addendum, engine/API.md commit b4cf9f1); and the read-out pins (rows of
#                existing functions, and of the new ones, at the Part 1 apps' settings: "Read-out pins").
# Written from that section of engine/API.md alone, with the conventions it refers to ("Shared types", "v3 helpers
# (Phase 2, Step 2.1)", "v3 helpers: readings fixed at Step 2.5"), the specifications of the existing functions the pins
# call (engine/API.md, engine/README.md), the SR-06 league specification and the stream reimplementation r-export/_rng.R;
# the formatProb rows follow engine/README.md "format.ts: display rules" and r-export/11_format.R. The engine's
# TypeScript and built JavaScript were not read. Units are 1-based here and 0-based in the rows. Every numeric input is
# a double that survives the 15-significant-digit JSON text, or the token {"$num": "<17 significant digits>"} (the exact
# double; also "Infinity", "-Infinity", "NaN"), and every expected value is computed from those inputs. Each row carries
# record$kind (example: from the specification's text; case; edge; throw; pin: an app setting) and record$needs
# ("existing": the current engine has the function and every compared field; "step-3.27": a new function, option or
# field), neither compared.
# Readings where the text leaves a choice (r-export/README.md points here):
#   R1 pairDifference: the variance is sdA*sdA + sdB*sdB - 2*corr*sdA*sdB in that order, sd = sqrt of it, z = mean/sd,
#      pi = Phi(z) (lower tail, R pnorm); "degenerate" is a variance that is not > 0: exactly 0 (corr 1, equal SDs) or
#      rounded below 0 (corr 1, sdA .3, sdB .3 (1 + 3 2^-52): -2.8e-17, whose square root is NaN), a RangeError as the
#      existing pairDirection throws for both. corr = 1 with clearly unequal SDs is valid.
#   R2 normalCoverage(k) = pnorm(k) - pnorm(-k) as written (not 1 - 2 pnorm(-k)); k = 0 gives 0, k = Infinity gives 1.
#   R3 withinBand: z_i = (est_i - ref_i)/se_i in double, within = #{|z_i| <= crit}; so est .8, ref .5, se .2 has
#      z = 1.5000000000000002 and is outside crit 1.5 although |est - ref| = crit*se in decimals. share = pnorm(crit) -
#      pnorm(-crit); expected = n*share. One number for se or ref is used for every unit.
#   R4 sharedMeanPosterior: s2 = priorSd*priorSd, v_i = s2 + se_i*se_i, B_i = s2/v_i; with a finite meanSd the prior
#      terms are 1/(meanSd*meanSd) and priorMean/(meanSd*meanSd) (a division); Sigma_i 1/v_i and Sigma_i est_i/v_i are
#      left-to-right sums from 0, then muVar = 1/(prior term + sum), muMean = muVar*(prior term + sum); var_i =
#      priorSd*priorSd*se_i*se_i/v_i (left to right: the specification's 17-digit sds follow this order; (s2*(se*se))/v
#      is one ulp off for example (a)) + (1 - B_i)^2*muVar; corr_ij = ((1 - B_i)(1 - B_j) muVar)/(sds_i sds_j), exactly
#      1 on the diagonal. With meanSd = Infinity priorMean has no effect.
#   R5 claimsByDistance: weighted errors w_1 e_1 + w_2 e_2 + ... in criterion order; expected = left-to-right sum over
#      a = 1, 2, ... (a compensated sum agrees within the adapter's tolerance); one entry per distance 1..n-1.
#   R6 finiteLawCells: probs = null gives count/S (exact counts, one division); otherwise cells sum probs in state order;
#      values are distinct under ===, so 0.1 + 0.2 and 0.3 are two values; i > j is allowed (the transposed table).
#   R7 binomialMcse = sqrt((e*(1 - e))/S); e = 0 or 1 give 0.
#   R8 maxCoefficientError: |ehat - e| in double; the first largest in row-major (i, j) order with a strict update, so
#      equal arrays give epsilon 0 at { i: 0, j: 1 }.
#   R9 chainCountLaw: pi0 = 1 - pi1, P(0 -> 0) = 1 - p01, P(1 -> 1) = 1 - p10 as doubles; each cell of f_{t+1} is the sum
#      of its two contributions (from x = 0 and x = 1; the order of two terms does not change a double); outside sums
#      probs[c] for c = 0..S with abs(c/S - pi1) > radius (c/S a division) in c order, 0 when no c qualifies, null
#      without a radius (radius: null is the same); the reference is a compensated sum (the engine's sum convention; a
#      plain left-to-right sum agrees within 1e-15 on every row). "Stay .99" is p01 = p10 = .01 as the text says; the
#      printed stay-.99 values need 1 - .99 = 0.010000000000000009, so the pins are written at both p.
#   R10 runningMean: a plain running sum s_b = s_{b-1} + trace[b] and m_b = s_b/b.
#   R11 disclosure: withheld = M - N for every report (all-withheld: withheld = M).
#   R12 leastCertainPairs: pos(i) is the 0-based position of unit i in `order`; apart = |pos(i) - pos(j)|; an `order`
#      that is not a permutation of 0..n-1 throws; without `order` no pair has an `apart` key.
#   R13 intervalOverlapTally: amount = min(upper_i, upper_j) - max(lower_i, lower_j) in double (0 for touching intervals,
#      negative for a gap); nested uses <= on both ends (equal and shared-endpoint intervals are nested).
#   R14 majorityWins: cycleTriples uses the same strict "beats" as cycles (a pair within tieTol breaks a cycle);
#      a triple a < b < c is [a, b, c] when a beats b, b beats c and c beats a, else [a, c, b]; [] when there is none.
#   R15 formatProb open: with open and bounds not false, exact 0 -> "below .0..1" ("<.0..1" with symbols) and exact 1 ->
#      "above .9..9" (">.9..9") at `digits`; other values and bounds false as before; open: false is the default.
#   R16 Throw rows expect a throw; RangeError only for pairDifference's degenerate difference (the one place the text
#      names it); an unknown option key throws a TypeError whose message names the key (the v3 convention); a number
#      where the options belong throws a TypeError.
#   R17 Pins: the teaching posterior has prior mean 0 (B = s^2/(s^2 + SE^2), mean B*est, sd sqrt(B)*SE; flat prior B = 1);
#      "gaussianDraws + drawErrors" is one composite row (fn drawErrorsOfGaussianDraws) per S and score set, and the
#      exact arrays are the released ones (six-sites.json arrays.one and arrays.two); a mixture's lower-bump weight is
#      1 - w as a double; finite laws with equally likely states pass probs = null.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R"); source("r-export/_rng.R")
assert_no_postrank()

# ---- JSON shaping and checks --------------------------------------------------------------------------------------
vec <- function(x) I(unname(x))
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r
row <- function(id, fn, args, expect, kind, needs = "step-3.27", record = NULL) {
  stopifnot(kind %in% c("example", "case", "edge", "throw", "pin"), needs %in% c("existing", "step-3.27"))
  list(id = id, args = c(list(fn = fn), args), expect = expect, record = c(list(kind = kind, needs = needs), record))
}
check_close <- function(a, b, tol, label) {
  a <- as.numeric(unlist(a)); b <- as.numeric(unlist(b))
  if (length(a) != length(b) || any(is.na(a) != is.na(b))) stop("check failed (shape/NA): ", label, call. = FALSE)
  d <- max(c(0, abs(a - b)), na.rm = TRUE)
  if (d > tol) stop(sprintf("check failed: %s (max diff %.3g > %.3g)", label, d, tol), call. = FALSE)
  invisible(d)
}
# Decimal text is parsed by jsonlite (correctly rounded, as the engine's JSON.parse and Number()). R's own parser is not
# on this build (aarch64, long double = double): 0.19999999999999998 parses to 0.2, and as.numeric(sprintf("%.15g", x))
# moves about one 15-digit value in five below 1e-20 by an ulp (two released six-site errors among them), so this script
# writes no 16- or 17-digit literal and reads every released number and every 15-digit rounding through jsonlite.
jparse <- function(txt) as.numeric(jsonlite::fromJSON(paste0("[", paste(txt, collapse = ","), "]")))
# A specification example printed with d significant digits: x must print as that text with d digits, or lie within
# 2 ulps of it (16- and 17-digit examples whose last digit differs by an ulp, e.g. from the engine's normalCdf, which
# agrees with R's pnorm to a few ulps; every such case is listed at the end).
spec_notes <- character()
ulp <- function(v) 2^(floor(log2(abs(v))) - 52)
spec_txt <- function(x, txt, label) {
  v <- jparse(txt); m <- gsub(".", "", sub("^-", "", sub("[eE].*$", "", txt)), fixed = TRUE); d <- max(1, nchar(sub("^0+", "", m)))
  ok <- if (v == 0) x == 0 else jparse(sprintf(paste0("%.", d, "g"), x)) == v
  if (!isTRUE(ok) && v != 0 && abs(x - v) <= 2 * ulp(v)) {
    spec_notes <<- c(spec_notes, sprintf("%s: R gives %.17g, the text %s (%.1f ulp)", label, x, txt, abs(x - v) / ulp(v))); ok <- TRUE
  }
  if (!isTRUE(ok)) stop(sprintf("specification example %s: %.17g does not print as %s", label, x, txt), call. = FALSE)
  invisible(TRUE)
}
# The same, but a difference up to `tol` (absolute) is accepted and listed (examples computed by another route).
spec_close <- function(x, txt, tol, label) {
  ok <- tryCatch({ spec_txt(x, txt, label); TRUE }, error = function(e) FALSE)
  if (ok) return(invisible(TRUE))
  v <- jparse(txt); if (abs(x - v) > tol) stop(sprintf("specification example %s: %.17g is not within %g of %s", label, x, tol, txt), call. = FALSE)
  spec_notes <<- c(spec_notes, sprintf("%s: R gives %.17g, the text %s (%.2g apart)", label, x, txt, abs(x - v)))
  invisible(TRUE)
}
r15 <- function(x) { y <- x; ok <- is.finite(x); if (any(ok)) y[ok] <- jparse(sprintf("%.15g", x[ok])); y }
gap_ok <- function(x, tol = 1e-9) { s <- sort(x); stopifnot(length(s) < 2 || min(diff(s)) > tol); invisible(TRUE) }
lsum <- function(x) { s <- 0; for (v in x) s <- s + v; s }                       # left to right, as the spec orders it
ksum <- function(x) {                                                            # compensated (Neumaier) reference
  s <- 0; c <- 0
  for (v in x) { t <- s + v; c <- c + (if (abs(s) >= abs(v)) (s - t) + v else (v - t) + s); s <- t }
  s + c
}
safe15 <- function(x) { f <- is.finite(x); !any(f) || identical(jparse(sprintf("%.15g", x[f])), as.numeric(x[f])) }
NUM <- function(x) list(`$num` = if (is.nan(x)) "NaN" else if (is.infinite(x)) (if (x > 0) "Infinity" else "-Infinity") else sprintf("%.17g", x))
xarg <- function(x) if (length(x) == 1 && (!is.finite(x) || !safe15(x))) NUM(x) else x        # a scalar input, exact
cube_json <- function(a) lapply(seq_len(dim(a)[3]), function(k) unname(matrix(a[, , k], dim(a)[1], dim(a)[2])))
earr <- function(e, ids, criteria) list(ids = vec(ids), criteria = vec(criteria), e = cube_json(e))
states_json <- function(states) lapply(states, unname)                           # states[s][i][k] (n x K matrices)
wsum <- function(e, w = NULL) {                                                  # ebar = sum_k w_k e_k, criterion order
  K <- dim(e)[3]; if (is.null(w)) { stopifnot(K == 1); w <- 1 }
  out <- e[, , 1] * w[1]; if (K > 1) for (k in 2:K) out <- out + w[k] * e[, , k]; out
}
M_of <- function(n) n * (n - 1) / 2
hand_e <- function(n, pairs) {                                                   # pairs: list(c(i, j, e_ij, e_ji)), 1-based
  e <- matrix(NA_real_, n, n); for (p in pairs) { e[p[1], p[2]] <- p[3]; e[p[2], p[1]] <- p[4] }
  stopifnot(sum(is.na(e)) == n); array(e, c(n, n, 1))
}
hand2 <- function(eAB, eBA) array(c(NA, eBA, eAB, NA), c(2, 2, 1))
st1 <- function(...) lapply(list(...), function(v) cbind(v))                     # one-criterion states from unit vectors
dim1 <- function(e) array(e, c(dim(e)[1], dim(e)[2], 1))
# throw rows: fn "<name>Throws"; the adapter calls <name> with the row's arguments and reports how it threw.
thr <- function(fn, id, args, range_error = FALSE, unknown_key = NULL, options_type = FALSE, needs = "step-3.27") {
  ex <- list(threw = TRUE)
  if (range_error) ex$rangeError <- TRUE
  if (options_type) ex$typeError <- TRUE
  if (!is.null(unknown_key)) { args$unknownKey <- unknown_key; ex$typeError <- TRUE; ex$namesKey <- TRUE }
  add(row(paste0(fn, "-throws-", id), paste0(fn, "Throws"), args, ex, "throw", needs))
}

# ---- shared inputs ------------------------------------------------------------------------------------------------
source("r-export/15_part2.R")   # p2: six-site means and seeded draws, theory-book laws, KRW race card
num <- function(x) vapply(x, function(v) if (is.null(v)) NA_real_ else as.numeric(v), 0)
mat <- function(rows) t(vapply(rows, num, numeric(length(rows))))              # jsonlite's doubles: what the engine reads
six <- p2$six
six_rel <- jsonlite::fromJSON(file.path(released_dir, "six-sites.json"), simplifyVector = FALSE)
e6a <- array(mat(six_rel$arrays$one$e[[1]]), c(6, 6, 1))                         # 6 x 6 x 1, score A (released)
stopifnot(max(abs(e6a - six$e), na.rm = TRUE) < 1e-24)                           # p2's R-parsed copy is one ulp off in 2 cells
two <- six_rel$arrays$two
stopifnot(identical(unlist(two$criteria), c("score_A", "score_B")), identical(unlist(two$ids), six$ids))
e6ab <- array(c(mat(two$e[[1]]), mat(two$e[[2]])), c(6, 6, 2)); stopifnot(identical(e6ab[, , 1], e6a[, , 1]))
mB <- num(six_rel$tables$units$mean_B); stopifnot(all(num(six_rel$tables$units$sd_B) == 0.2))
ck <- jsonlite::fromJSON(file.path(released_dir, "case-krw.json"), simplifyVector = FALSE)
krw_ids <- unlist(ck$arrays$error$ids)
stopifnot(identical(unlist(ck$arrays$error$criteria), c("race_signed", "gender_signed")), identical(krw_ids, p2$krw$ids),
          identical(unlist(ck$tables$reports$id), krw_ids), identical(unlist(ck$tables$units$id), krw_ids))
e_race <- array(mat(ck$arrays$error$e[[1]]), c(97, 97, 1)); stopifnot(max(abs(e_race - p2$krw$e), na.rm = TRUE) < 1e-24)
e_gender <- array(mat(ck$arrays$error$e[[2]]), c(97, 97, 1))
race_card <- p2$krw$card; gender_card <- num(ck$tables$reports$gender_card)
stopifnot(identical(tabulate(race_card), c(2L, 81L, 14L)), identical(tabulate(gender_card), c(1L, 3L, 89L, 4L)))
mean_race <- num(ck$tables$units$mean_race); mean_gender <- num(ck$tables$units$mean_gender)
stopifnot(length(mean_race) == 97, length(mean_gender) == 97, all(is.finite(c(mean_race, mean_gender))))

# The SR-06 league (engine/API.md "Simulated league specification"); replay r of seed s is drawLeague(s + r).
lg <- list(ids = sprintf("U%02d", 1:30), size = rep(c(16, 64, 256), 10), group = rep(c("small", "medium", "large"), 10))
lg$se <- 0.8 / sqrt(lg$size); lg$rank <- (19 * (1:30)) %% 31; lg$theta <- 0.15 * qnorm((lg$rank - 0.5) / 30)
stopifnot(identical(sort(lg$rank), as.numeric(1:30)), identical(unique(lg$se), c(0.2, 0.1, 0.05)))
seed0 <- 20261030
draw <- function(seed) lg$theta + lg$se * prx_normals(seed, 30)
shrink <- function(sigma) if (is.infinite(sigma)) rep(1, 30) else sigma^2 / (sigma^2 + lg$se^2)   # flat prior: B = 1
post <- function(est, sigma) { B <- shrink(sigma); list(mean = B * est, sd = sqrt(B) * lg$se) }  # prior mean 0
err_normal <- function(m, s) {                     # errorArray of independent normals, one criterion, larger = higher
  n <- length(m); e <- matrix(NA_real_, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) e[i, j] <- pnorm((m[j] - m[i]) / sqrt(s[i]^2 + s[j]^2))
  e
}
est0 <- r15(draw(seed0)); th15 <- r15(lg$theta); gap_ok(est0)                    # drawLeague(20261030).estimate
p15 <- post(est0, 0.15); pm15 <- r15(p15$mean); sd15 <- r15(p15$sd); gap_ok(pm15)
e_lg15 <- array(r15(err_normal(p15$mean, p15$sd)), c(30, 30, 1))                 # the frozen draw's posterior E (prior .15)
ord15 <- order(-pm15, seq_len(30))                                                # posterior-mean order (no ties)

# ==== new functions ================================================================================================

# ---- pairDifference(meanA, sdA, meanB, sdB, { corr = 0 }) -> { mean, sd, z, pi } ---------------------------------
o_pdiff <- function(mA, sA, mB, sB, rho = 0) {
  m <- mA - mB; v <- sA * sA + sB * sB - 2 * rho * sA * sB; s <- sqrt(v)
  stopifnot(is.finite(s), s > 0)
  z <- m / s; list(mean = m, sd = s, z = z, pi = pnorm(z))
}
pdf_row <- function(id, mA, sA, mB, sB, corr = NULL, kind = "case", needs = "step-3.27") {
  mA <- as.numeric(mA); sA <- as.numeric(sA); mB <- as.numeric(mB); sB <- as.numeric(sB); if (!is.null(corr)) corr <- as.numeric(corr)
  r <- o_pdiff(mA, sA, mB, sB, if (is.null(corr)) 0 else corr)
  a <- list(meanA = xarg(mA), sdA = xarg(sA), meanB = xarg(mB), sdB = xarg(sB)); if (!is.null(corr)) a$corr <- xarg(corr)
  add(row(paste0("pairDifference-", id), "pairDifference", a, r, kind, needs)); invisible(r)
}
x <- pdf_row("spec-.30-.20-.10-.20", .30, .20, .10, .20, kind = "example")
stopifnot(sprintf("%.17g", x$mean) == "0.19999999999999998"); spec_txt(x$sd, "0.282842712474619", "pairDifference sd"); spec_txt(x$z, "0.707106781186547", "z")
spec_txt(x$pi, "0.760249938906523", "pi"); stopifnot(x$pi == pnorm((.30 - .10) / sqrt(.20^2 + .20^2)))       # = pairDirection
x <- pdf_row("spec-.30-.20-.10-.20-corr.5", .30, .20, .10, .20, 0.5, kind = "example")
spec_txt(x$sd, "0.2", "sd corr .5"); spec_txt(x$z, "1", "z corr .5"); spec_txt(x$pi, "0.841344746068543", "pi corr .5")
x <- pdf_row("spec-.30-.20-.10-.60", .30, .20, .10, .60, kind = "example")
spec_txt(x$sd, "0.632455532033676", "sd"); spec_txt(x$z, "0.316227766016838", "z"); spec_txt(x$pi, "0.624085182977075", "pi")
x <- pdf_row("spec-equal-means-.20-.20-.20-.40", .20, .20, .20, .40, kind = "example"); stopifnot(x$mean == 0, x$z == 0, x$pi == 0.5)
touch90 <- 2 * qnorm(0.95); stopifnot(sprintf("%.16g", touch90) == "3.289707253902943")   # the spec's input (90% intervals touch)
x <- pdf_row("spec-touching-90-intervals-3.289707253902943-1-0-1", touch90, 1, 0, 1, kind = "example")
spec_txt(x$sd, "1.4142135623731", "sd"); spec_txt(x$z, "2.32617430735335", "z"); spec_txt(x$pi, "0.989995373141941", "pi")
# both directions (B - A), the default corr against corr 0 given, and the 1.8/1.9/1.11 app settings
x <- pdf_row("reverse-.10-.20-.30-.20", .10, .20, .30, .20); stopifnot(sprintf("%.17g", x$mean) == "-0.19999999999999998")
pdf_row("reverse-.10-.60-.30-.20", .10, .60, .30, .20)
pdf_row("reverse-touching-0-1-3.289707253902943-1", 0, 1, touch90, 1)
pdf_row("corr0-explicit-.30-.20-.10-.20", .30, .20, .10, .20, 0)
pdf_row("pin-1.8-sites-A-B-1.20-.20-.95-.20", 1.20, .20, .95, .20, kind = "pin")
for (rho in c(0.95, -0.95)) pdf_row(sprintf("pin-1.9-corr%s", sub("0\\.", ".", sprintf("%.2f", rho))), .30, .20, .10, .20, rho, kind = "pin")
pdf_row("pin-1.11-touching-95-intervals", 2 * qnorm(0.975), 1, 0, 1, kind = "pin")
pdf_row("pin-1.11-means-2-sd-apart", 2, 1, 0, 1, kind = "pin"); pdf_row("pin-1.11-means-1-sd-apart", 1, 1, 0, 1, kind = "pin")
x <- pdf_row("corr1-unequal-sds-.3-.3-.1-.2", .3, .3, .1, .2, 1, kind = "edge"); stopifnot(x$sd > 0)        # (sdA - sdB)^2 > 0
pdf_row("corr-minus1-.3-.2-.1-.2", .3, .2, .1, .2, -1, kind = "edge")
x <- pdf_row("far-lower-tail--2-.1-2-.1", -2, .1, 2, .1, kind = "edge"); stopifnot(x$pi > 0, x$pi < 1e-170)  # lower tail kept
x <- pdf_row("far-upper-tail-2-.1--2-.1", 2, .1, -2, .1, kind = "edge"); stopifnot(x$pi == 1)
pdf_row("negative-means-unequal-sds-corr-.25", -1.3, .4, -.2, .7, -0.25)
pdf_row("large-scale-120-15-95-20-corr.3", 120, 15, 95, 20, 0.3)
# Throws (R16): a non-finite mean, SDs not finite and > 0, corr outside [-1, 1] or not finite, a degenerate difference
# (sd exactly 0: corr 1 with equal SDs) is a RangeError, an unknown key, a number where the options belong.
pa <- function(mA = .3, sA = .2, mB = .1, sB = .2) list(meanA = mA, sdA = sA, meanB = mB, sdB = sB)
thr("pairDifference", "meanA-NaN", pa(mA = NUM(NaN))); thr("pairDifference", "meanB-Infinity", pa(mB = NUM(Inf)))
thr("pairDifference", "sdA-0", pa(sA = 0)); thr("pairDifference", "sdB-negative", pa(sB = -0.2))
thr("pairDifference", "sdA-Infinity", pa(sA = NUM(Inf))); thr("pairDifference", "sdB-NaN", pa(sB = NUM(NaN)))
thr("pairDifference", "corr-1.5", c(pa(), list(corr = 1.5))); thr("pairDifference", "corr--1.01", c(pa(), list(corr = -1.01)))
thr("pairDifference", "corr-NaN", c(pa(), list(corr = NUM(NaN)))); thr("pairDifference", "corr-Infinity", c(pa(), list(corr = NUM(Inf))))
stopifnot(.2 * .2 + .2 * .2 - 2 * 1 * .2 * .2 == 0, 1 * 1 + 1 * 1 - 2 * 1 * 1 * 1 == 0, .3 * .3 + .3 * .3 - 2 * 1 * .3 * .3 == 0)
thr("pairDifference", "degenerate-corr1-equal-sds-.2", c(pa(), list(corr = 1)), range_error = TRUE)
thr("pairDifference", "degenerate-corr1-equal-sds-1", c(pa(mA = 1, sA = 1, mB = 0, sB = 1), list(corr = 1)), range_error = TRUE)
thr("pairDifference", "degenerate-corr1-equal-sds-.3-equal-means", c(pa(mA = .5, sA = .3, mB = .5, sB = .3), list(corr = 1)), range_error = TRUE)
sB_up <- .3 * (1 + 3 * 2^-52); stopifnot(.3 * .3 + sB_up * sB_up - 2 * 1 * .3 * sB_up < 0)   # the variance rounds below 0
thr("pairDifference", "degenerate-corr1-variance-rounds-negative", c(pa(sA = .3, sB = NUM(sB_up)), list(corr = 1)), range_error = TRUE)
thr("pairDifference", "unknown-key-rho", c(pa(), list(opts = list(rho = 0.5))), unknown_key = "rho")
thr("pairDifference", "options-a-number", c(pa(), list(opts = 0.5)), options_type = TRUE)

# ---- normalCoverage(k) = Phi(k) - Phi(-k) ------------------------------------------------------------------------
o_cov <- function(k) pnorm(k) - pnorm(-k)
ncv <- function(id, k, kind = "case") { v <- o_cov(k); add(row(paste0("normalCoverage-", id), "normalCoverage", list(k = xarg(k)), list(coverage = v), kind)); invisible(v) }
stopifnot(ncv("spec-0", 0, "example") == 0); spec_txt(ncv("spec-1", 1, "example"), "0.6826894921370859", "normalCoverage(1)")
spec_txt(ncv("spec-2", 2, "example"), "0.9544997361036416", "normalCoverage(2)")
stopifnot(ncv("Infinity", Inf, "edge") == 1)
for (k in c(0.5, 1.5, 1.96, 3)) ncv(sprintf("%g", k), k)
ncv("qnorm.95-exact", qnorm(0.95)); ncv("qnorm.975-exact", qnorm(0.975))
ncv("tiny-1e-8", 1e-8, "edge"); ncv("8", 8, "edge"); ncv("8.3", 8.3, "edge"); ncv("40", 40, "edge")
ncv("pin-1.1-k1", 1, "pin"); ncv("pin-1.2-k1", 1, "pin")
thr("normalCoverage", "negative-1", list(k = -1)); thr("normalCoverage", "negative-tiny-2^-1000", list(k = NUM(-2^-1000)))
thr("normalCoverage", "NaN", list(k = NUM(NaN))); thr("normalCoverage", "-Infinity", list(k = NUM(-Inf)))

# ---- withinBand(est, se, { ref, crit = 1 }) -> { within, n, share, expected } ------------------------------------
o_wb <- function(est, se, ref, crit = 1) {
  n <- length(est); z <- (est - rep_len(ref, n)) / rep_len(se, n)
  list(within = sum(abs(z) <= crit), n = n, share = o_cov(crit), expected = n * o_cov(crit), z = z)
}
wb <- function(id, est, se, ref, crit = NULL, kind = "case", margin = NULL) {
  r <- o_wb(est, se, ref, if (is.null(crit)) 1 else crit)
  md <- min(abs(abs(r$z) - (if (is.null(crit)) 1 else crit)))
  if (!is.null(margin)) stopifnot(md > margin)                                    # no estimate near the band edge
  a <- list(est = vec(est), se = if (length(se) > 1) vec(se) else se, ref = if (length(ref) > 1) vec(ref) else xarg(ref))
  if (!is.null(crit)) a$crit <- xarg(crit)
  add(row(paste0("withinBand-", id), "withinBand", a, r[c("within", "n", "share", "expected")], kind,
          record = list(z = vec(r$z), minDistanceFromCrit = md))); invisible(r)
}
x <- wb("spec-.5-.8-.1-.45-se.2-ref.5", c(.5, .8, .1, .45), .2, .5, kind = "example")
stopifnot(x$within == 2, x$n == 4, sprintf("%.17g", x$z[2]) == "1.5000000000000002", x$z[2] == 1.5 + 2^-52, x$z[3] == -2)
spec_txt(x$share, "0.6826894921370859", "withinBand share"); spec_txt(x$expected, "2.7307579685483434", "withinBand expected")
# The z route (R3): z = 1.5000000000000002 is outside crit 1.5 and inside crit 1.5000000000000002; |z| = 2 at crit 2 is inside.
x <- wb("crit1.5-z-1.5000000000000002-outside", c(.5, .8, .1, .45), .2, .5, 1.5); stopifnot(x$within == 2)
x <- wb("crit1.5000000000000002-inside", c(.5, .8, .1, .45), .2, .5, 1.5 + 2^-52); stopifnot(x$within == 3)
x <- wb("crit2-z--2-inside", c(.5, .8, .1, .45), .2, .5, 2); stopifnot(x$within == 4)
x <- wb("crit0-only-z0", c(.5, .8, .1, .45), .2, .5, 0, kind = "edge"); stopifnot(x$within == 1, x$share == 0, x$expected == 0)
# |z| exactly 1 is inside (non-strict): (.3 - .5)/.2 = -1 and (.9 - .5)/.4 = 1 exactly; (.7 - .5)/.2 = .9999999999999998.
x <- wb("z-exactly-plus-minus-1-inside", c(.3, .9, .7), c(.2, .4, .2), .5, kind = "edge")
stopifnot(identical(x$z, c(-1, 1, 1 - 2^-52)), x$within == 3)
x <- wb("per-unit-se-and-ref", c(.1, .25, -.4, .45), c(.1, .2, .05, .4), c(0, .5, -.3, .1)); stopifnot(x$within == 2)   # z 1, -1.25, -2.0000000000000004, .875
wb("one-unit", .62, .1, .5, kind = "edge"); wb("crit1.96", c(.1, -.25, .3, .05, -.38), .15, 0, 1.96)
# pins (1.2): simulateEstimates(truth, se, n, seed) = truth + se * normals(seed, n), written with 15 digits
sim <- function(truth, se, n, seed) r15(truth + se * prx_normals(seed, n))
for (cfg in list(c(.5, .2, 20, 1), c(.5, .2, 21, 1), c(.5, .2, 200, 1), c(.5, .2, 20, 2), c(.5, .1, 20, 1), c(.5, .05, 20, 1), c(-.3, .05, 7, 20261030)))
  wb(sprintf("pin-1.2-simulateEstimates-truth%g-se%g-n%d-seed%d", cfg[1], cfg[2], cfg[3], cfg[4]), sim(cfg[1], cfg[2], cfg[3], cfg[4]),
     cfg[2], cfg[1], kind = "pin", margin = 1e-9)
check_close(vapply(rows[vapply(rows, function(r) grepl("^withinBand-pin-1.2", r$id), TRUE)], function(r) as.numeric(r$expect$within), 0),
            c(12, 13, 132, 18, 12, 12, 5), 0, "1.2 within counts (catalog: 12 of 20, 132 of 200, 18 of 20)")
wv <- c(.5, .8, .1)
thr("withinBand", "est-empty", list(est = I(numeric(0)), se = .2, ref = .5)); thr("withinBand", "est-NaN", list(est = list(.5, NUM(NaN)), se = .2, ref = .5))
thr("withinBand", "se-0", list(est = vec(wv), se = 0, ref = .5)); thr("withinBand", "se-negative", list(est = vec(wv), se = -.2, ref = .5))
thr("withinBand", "se-NaN", list(est = vec(wv), se = NUM(NaN), ref = .5)); thr("withinBand", "se-length2-n3", list(est = vec(wv), se = vec(c(.2, .2)), ref = .5))
thr("withinBand", "ref-missing", list(est = vec(wv), se = .2)); thr("withinBand", "ref-NaN", list(est = vec(wv), se = .2, ref = NUM(NaN)))
thr("withinBand", "ref-Infinity", list(est = vec(wv), se = .2, ref = NUM(Inf))); thr("withinBand", "ref-length2-n3", list(est = vec(wv), se = .2, ref = vec(c(.5, .5))))
thr("withinBand", "crit-negative", list(est = vec(wv), se = .2, ref = .5, crit = -1)); thr("withinBand", "crit-Infinity", list(est = vec(wv), se = .2, ref = .5, crit = NUM(Inf)))
thr("withinBand", "crit-NaN", list(est = vec(wv), se = .2, ref = .5, crit = NUM(NaN)))
thr("withinBand", "unknown-key-level", list(est = vec(wv), se = .2, opts = list(ref = .5, level = .9)), unknown_key = "level")

# ---- sharedMeanPosterior(est, se, { priorSd, meanSd = Infinity, priorMean = 0 }) (R4) -----------------------------
o_smp <- function(est, se, sigma, smu = Inf, mu0 = 0) {
  n <- length(est); se <- rep_len(se, n); s2 <- sigma * sigma
  v <- s2 + se * se; B <- s2 / v
  pv <- if (is.infinite(smu)) 0 else 1 / (smu * smu); pm <- if (is.infinite(smu)) 0 else mu0 / (smu * smu)
  muVar <- 1 / (pv + lsum(1 / v)); muMean <- muVar * (pm + lsum(est / v))
  means <- (1 - B) * muMean + B * est
  sds <- sqrt(sigma * sigma * se * se / v + (1 - B)^2 * muVar)                   # left to right: the spec's printed digits
  corr <- outer(1 - B, 1 - B) * muVar / outer(sds, sds); diag(corr) <- 1
  list(weight = vec(B), muMean = muMean, muVar = muVar, means = vec(means), sds = vec(sds), corr = unname(corr))
}
smp <- function(id, est, se, sigma, smu = NULL, mu0 = NULL, kind = "case") {
  r <- o_smp(est, se, sigma, if (is.null(smu)) Inf else smu, if (is.null(mu0)) 0 else mu0)
  a <- list(est = vec(est), se = if (length(se) > 1) vec(se) else se, priorSd = sigma)
  if (!is.null(smu)) a$meanSd <- xarg(smu)
  if (!is.null(mu0)) a$priorMean <- mu0
  add(row(paste0("sharedMeanPosterior-", id), "sharedMeanPosterior", a, r, kind)); invisible(r)
}
sa <- smp("spec-.30-.10-se.20-prior.10-meanSd.50", c(.30, .10), .20, .10, .50, kind = "example")
check_close(c(sa$weight, sa$muMean, sa$muVar, sa$corr[1, 2]), c(.2, .2, 2/11, 1/44, 20/31), 4e-16, "sharedMeanPosterior (a): .2, 2/11, 1/44, 20/31")
spec_txt(sa$means[1], "0.20545454545454547", "means[0]"); spec_txt(sa$means[2], "0.16545454545454547", "means[1]")
spec_txt(sa$sds[1], "0.15015143870590966", "sds[0]"); stopifnot(sa$sds[1] == sa$sds[2])
sb <- smp("spec-.30-.10--.20-se.10-.20-.40-prior.15-flat", c(.30, .10, -.20), c(.10, .20, .40), .15, kind = "example")
for (t in list(list(sb$weight, c("0.6923076923076923", "0.36", "0.12328767123287669")), list(sb$muMean, "0.18631816715069377"),
               list(sb$muVar, "0.01913923846402065"), list(sb$means, c("0.26502097450790574", "0.155243626976444", "0.13868989996773157")),
               list(sb$sds, c("0.0934616275854064", "0.14912891092897734", "0.18557185975765336")),
               list(sb$corr[cbind(c(1, 1, 2), c(2, 3, 3))], c("0.2704120748654439", "0.29768225472223053", "0.38805007788997653"))))
  for (i in seq_along(t[[2]])) spec_txt(t[[1]][i], t[[2]][i], "sharedMeanPosterior (b)")
sb2 <- smp("spec-b-meanSd-Infinity-explicit", c(.30, .10, -.20), c(.10, .20, .40), .15, Inf); stopifnot(identical(sb, sb2))
sb3 <- smp("flat-priorMean-has-no-effect", c(.30, .10, -.20), c(.10, .20, .40), .15, mu0 = 0.4); stopifnot(identical(sb, sb3))
smp("finite-meanSd-priorMean.05", c(.30, .10, -.20), c(.10, .20, .40), .15, .10, .05)
x1 <- smp("one-unit-flat", .3, .2, .1, kind = "edge"); check_close(c(x1$means, x1$sds, x1$corr), c(.3, .2, 1), 1e-16, "one unit, flat: est, se, 1")
smp("one-unit-meanSd.5", .3, .2, .1, .5, kind = "edge")
x2 <- smp("common-se-number", c(.4, -.1, .25, .05), .15, .2); x3 <- smp("common-se-array", c(.4, -.1, .25, .05), rep(.15, 4), .2)
stopifnot(identical(x2, x3))
x4 <- smp("tiny-meanSd-1e-6-mean-nearly-known", c(.30, .10), .20, .10, 1e-6, .05, kind = "edge"); stopifnot(x4$corr[1, 2] < 1e-9)
smp("huge-meanSd-1e6", c(.30, .10), .20, .10, 1e6, kind = "edge")
smp("league-30-units-flat-prior.15", est0, lg$se, .15)
smp("pin-1.9-shared-mean", c(.30, .10), c(.20, .20), .10, .50, kind = "pin")
# then pairDifference with that corr (the 1.9 shared-mean preset): pi .6240851829770754, and .5747073311990831 with corr 0
x <- pdf_row("spec-shared-mean-follow-up-corr", sa$means[1], sa$sds[1], sa$means[2], sa$sds[2], sa$corr[1, 2], kind = "example")
spec_txt(x$pi, "0.6240851829770754", "pairDifference after sharedMeanPosterior")
x <- pdf_row("spec-shared-mean-follow-up-corr0", sa$means[1], sa$sds[1], sa$means[2], sa$sds[2], 0, kind = "example")
spec_txt(x$pi, "0.5747073311990831", "pairDifference after sharedMeanPosterior, corr 0")
sv <- c(.3, .1, -.2)
thr("sharedMeanPosterior", "est-empty", list(est = I(numeric(0)), se = .2, priorSd = .15))
thr("sharedMeanPosterior", "est-NaN", list(est = list(.3, NUM(NaN)), se = .2, priorSd = .15))
thr("sharedMeanPosterior", "se-0", list(est = vec(sv), se = 0, priorSd = .15)); thr("sharedMeanPosterior", "se-negative", list(est = vec(sv), se = -.1, priorSd = .15))
thr("sharedMeanPosterior", "se-length2-n3", list(est = vec(sv), se = vec(c(.1, .2)), priorSd = .15))
thr("sharedMeanPosterior", "priorSd-missing", list(est = vec(sv), se = .2)); thr("sharedMeanPosterior", "priorSd-0", list(est = vec(sv), se = .2, priorSd = 0))
thr("sharedMeanPosterior", "priorSd-Infinity", list(est = vec(sv), se = .2, priorSd = NUM(Inf)))
thr("sharedMeanPosterior", "priorSd-negative", list(est = vec(sv), se = .2, priorSd = -.15))
thr("sharedMeanPosterior", "meanSd-0", list(est = vec(sv), se = .2, priorSd = .15, meanSd = 0))
thr("sharedMeanPosterior", "meanSd-negative", list(est = vec(sv), se = .2, priorSd = .15, meanSd = -1))
thr("sharedMeanPosterior", "meanSd-NaN", list(est = vec(sv), se = .2, priorSd = .15, meanSd = NUM(NaN)))
thr("sharedMeanPosterior", "priorMean-NaN", list(est = vec(sv), se = .2, priorSd = .15, priorMean = NUM(NaN)))
thr("sharedMeanPosterior", "priorMean-Infinity", list(est = vec(sv), se = .2, priorSd = .15, priorMean = NUM(Inf)))
thr("sharedMeanPosterior", "unknown-key-sigma", list(est = vec(sv), se = .2, opts = list(priorSd = .15, sigma = .1)), unknown_key = "sigma")

# ---- claimsByDistance(g, E, { w }) (R5) -----------------------------------------------------------------------------
o_cbd <- function(g, e, w = NULL) {
  n <- length(g); stopifnot(identical(sort(as.integer(g)), seq_len(n)))
  eb <- wsum(e, w); u <- order(g)                                               # u[a] = the unit with grade a
  parts <- lapply(seq_len(n - 1), function(d) {
    v <- vapply(seq_len(n - d), function(a) eb[u[a], u[a + d]], 0)
    stopifnot(abs(lsum(v) - ksum(v)) <= 1e-14 * abs(ksum(v)) + 1e-300)          # plain and compensated sums agree
    list(distance = d, count = n - d, expected = lsum(v), max = max(v))
  })
  pull <- function(f) vec(vapply(parts, function(p) as.numeric(p[[f]]), 0))
  list(distance = vec(as.integer(pull("distance"))), count = vec(as.integer(pull("count"))), expected = pull("expected"), max = pull("max"))
}
cbd <- function(id, g, e, ids, criteria, w = NULL, kind = "case") {
  r <- o_cbd(g, e, w); a <- list(g = vec(g), E = earr(e, ids, criteria)); if (!is.null(w)) a$w <- vec(w)
  add(row(paste0("claimsByDistance-", id), "claimsByDistance", a, r, kind)); invisible(r)
}
e3 <- hand_e(3, list(c(1, 2, .1, .9), c(2, 3, .3, .7), c(1, 3, .05, .95)))
x <- cbd("spec-three-units-123", 1:3, e3, LETTERS[1:3], "score", kind = "example")
stopifnot(identical(unclass(x$distance), 1:2), identical(unclass(x$count), 2:1), identical(unclass(x$expected), c(.4, .05)),
          identical(unclass(x$max), c(.3, .05)))
x <- cbd("three-units-reversed-321", 3:1, e3, LETTERS[1:3], "score"); stopifnot(identical(unclass(x$max), c(.9, .95)))
x <- cbd("three-units-permutation-231", c(2, 3, 1), e3, LETTERS[1:3], "score")      # grade 1 = C, 2 = A, 3 = B
stopifnot(identical(unclass(x$expected), c(.95 + .1, .7)), identical(unclass(x$max), c(.95, .7)))
x <- cbd("spec-six-scoreA-by-posterior-mean", 1:6, e6a, six$ids, "score_A", kind = "example")
spec_txt(x$expected[1], "0.712080844765332", "d1"); spec_txt(x$max[1], "0.361836804915882", "d1 max (C above D)")
spec_txt(x$expected[2], "0.00712677687335478", "d2"); spec_txt(x$max[2], "0.00400497116494002", "d2 max")
spec_txt(x$expected[3], "0.000205523306237474", "d3"); spec_txt(x$max[3], "0.000102687868070609", "d3 max")
spec_txt(x$expected[4], "1.23152871637185e-9", "d4"); spec_txt(x$max[4], "9.25287068693378e-10", "d4 max")
# The specification prints the distance-5 value as 7.68729897214031e-13; the released array's e(A above F) is
# 7.68729897214026e-13 (and a fresh pnorm gives the same 15 digits), 6.5e-15 relative apart (reported, not fixed).
check_close(x$expected[5], 7.68729897214031e-13, 1e-26, "d5 (spec text 7.68729897214031e-13)"); stopifnot(x$expected[5] == e6a[1, 6, 1])
cbd("six-scoreA-reversed", 6:1, e6a, six$ids, "score_A")
cbd("six-AB-w.5-.5", 1:6, e6ab, six$ids, c("score_A", "score_B"), c(.5, .5))
cbd("six-AB-w.25-.75-permutation", c(2, 1, 3, 5, 4, 6), e6ab, six$ids, c("score_A", "score_B"), c(.25, .75))
cbd("two-units", c(2, 1), hand2(.3, .7), c("A", "B"), "score", kind = "edge")
cbd("league-posterior.15-by-posterior-mean", order(ord15), e_lg15, lg$ids, "theta")
cbd("pin-1.16-krw-race-by-posterior-mean", order(order(-mean_race, seq_len(97))), e_race, krw_ids, "race_signed", kind = "pin")
cbd("krw-gender-by-posterior-mean", order(order(-mean_gender, seq_len(97))), e_gender, krw_ids, "gender_signed")
cbd("pin-1.16-six-sites", 1:6, e6a, six$ids, "score_A", kind = "pin")
cbd("pin-1.16-league-by-posterior-mean", order(ord15), e_lg15, lg$ids, "theta", kind = "pin")
ce <- function(g, e = e3, ids = LETTERS[1:3], criteria = "score") list(g = vec(g), E = earr(e, ids, criteria))
thr("claimsByDistance", "g-repeated-grade", ce(c(1, 1, 2))); thr("claimsByDistance", "g-grade0", ce(c(0, 1, 2)))
thr("claimsByDistance", "g-grade4-n3", ce(c(1, 2, 4))); thr("claimsByDistance", "g-2-3-4-not-1-to-n", ce(c(2, 3, 4)))
thr("claimsByDistance", "g-non-integer", ce(c(1, 2.5, 3))); thr("claimsByDistance", "g-length2-E-n3", ce(c(1, 2)))
thr("claimsByDistance", "n1", ce(1, array(NA_real_, c(1, 1, 1)), "A"))
thr("claimsByDistance", "w-sum.9", c(ce(1:6, e6ab, six$ids, c("score_A", "score_B")), list(w = vec(c(.5, .4)))))
thr("claimsByDistance", "w-negative", c(ce(1:6, e6ab, six$ids, c("score_A", "score_B")), list(w = vec(c(1.2, -.2)))))
thr("claimsByDistance", "w-length3-K2", c(ce(1:6, e6ab, six$ids, c("score_A", "score_B")), list(w = vec(c(.5, .25, .25)))))
thr("claimsByDistance", "unknown-key-tau", c(ce(1:3), list(opts = list(tau = .2))), unknown_key = "tau")

# ---- finiteLawCells(states, probs, { i, j, criterion = 0 }) (R6) ----------------------------------------------------
o_flc <- function(states, probs, i, j, k = 1) {
  S <- length(states); vi <- vapply(states, function(m) m[i, k], 0); vj <- vapply(states, function(m) m[j, k], 0)
  rv <- sort(unique(vi)); cv <- sort(unique(vj)); cells <- matrix(0, length(rv), length(cv))
  for (r in seq_along(rv)) for (c in seq_along(cv)) {
    hit <- vi == rv[r] & vj == cv[c]
    if (any(hit)) cells[r, c] <- if (is.null(probs)) sum(hit) / S else lsum(probs[hit])
  }
  list(rowValues = vec(rv), colValues = vec(cv), cells = unname(cells))
}
flc <- function(id, states, probs, i, j, criterion = NULL, kind = "case", states_arg = NULL) {
  r <- o_flc(states, probs, i, j, if (is.null(criterion)) 1 else criterion + 1)
  a <- list(states = if (is.null(states_arg)) states_json(states) else states_arg, probs = if (is.null(probs)) NA else vec(probs), i = i - 1L, j = j - 1L)
  if (!is.null(criterion)) a$criterion <- criterion
  add(row(paste0("finiteLawCells-", id), "finiteLawCells", a, r, kind)); invisible(r)
}
law1 <- st1(c(0, 1), c(1, 2), c(2, 0)); law2 <- st1(c(0, 2), c(1, 0), c(2, 1))
lawI <- do.call(st1, lapply(0:8, function(t) c(t %/% 3, t %% 3))); lawE <- st1(c(0, 0), c(1, 1), c(2, 2))
x <- flc("spec-tb09-law1-equal-weights", law1, NULL, 1, 2, kind = "example")
stopifnot(identical(unclass(x$rowValues), c(0, 1, 2)), identical(unclass(x$colValues), c(0, 1, 2)),
          identical(x$cells, matrix(c(0, 0, 1/3, 1/3, 0, 0, 0, 1/3, 0), 3, 3)))
flc("spec-tb09-law1-probs-1/3", law1, rep(r15(1/3), 3), 1, 2, kind = "example")
x <- flc("tb09-law1-i1-j0-transposed", law1, NULL, 2, 1); stopifnot(identical(x$cells, t(o_flc(law1, NULL, 1, 2)$cells)))
flc("tb09-law2", law2, NULL, 1, 2); flc("independence-nine-states", lawI, NULL, 1, 2); flc("always-equal", lawE, NULL, 1, 2)
flc("pin-1.10-law1", law1, NULL, 1, 2, kind = "pin"); flc("pin-1.10-law2", law2, NULL, 1, 2, kind = "pin")
flc("pin-1.10-independence", lawI, NULL, 1, 2, kind = "pin"); flc("pin-1.10-always-equal", lawE, NULL, 1, 2, kind = "pin")
x <- flc("two-states-in-one-cell-summed-in-state-order", st1(c(0, 1), c(0, 1), c(1, 0), c(1, 1)), c(.1, .2, .3, .4), 1, 2)
stopifnot(x$cells[1, 2] == 0.1 + 0.2, x$cells[1, 2] != 0.3)
s19 <- lapply(p2$tb19$states, cbind)
x <- flc("tb19-law3-A-C", s19, c(.3, .7), 1, 3); stopifnot(identical(x$cells, matrix(c(.7, .3), 2, 1)))
flc("tb19-law3-C-B-one-value-each", s19, c(.3, .7), 3, 2, kind = "edge")
s10 <- unname(lapply(p2$tb10$states, cbind)); flc("tb10-law3-orders-B-C", s10, p2$tb10$masses / 20, 2, 3)
tb14 <- list(rbind(c(4, 4), c(3, 2), c(2, 3), c(1, 1)), rbind(c(3, 1), c(4, 2), c(2, 3), c(1, 4)))
flc("tb14-criterion1-D-A", tb14, c(.75, .25), 4, 1, criterion = 1)
x0 <- flc("tb14-criterion0-explicit", tb14, c(.75, .25), 1, 2, criterion = 0); x0d <- flc("tb14-criterion-default", tb14, c(.75, .25), 1, 2)
stopifnot(identical(x0, x0d))
flc("one-state", list(rbind(c(1.5, -2), c(0, 0))), 1, 1, 2, kind = "edge")
flc("decimals-negatives-five-states", st1(c(-.5, .25), c(1.25, .25), c(-.5, -.75), c(2, .25), c(1.25, -.75)), c(.1, .2, .3, .15, .25), 1, 2)
# Exact equality (R6): the token {"$sum": [0.1, 0.2]} is 0.30000000000000004, a value distinct from 0.3.
sum_states <- list(cbind(c(0.3, 1)), cbind(c(0.1 + 0.2, 1)), cbind(c(0.3, 2)))
sum_arg <- list(list(list(0.3), list(1)), list(list(list(`$sum` = vec(c(0.1, 0.2)))), list(1)), list(list(0.3), list(2)))
x <- flc("exact-equality-0.1+0.2-is-not-0.3", sum_states, c(.25, .5, .25), 1, 2, kind = "edge", states_arg = sum_arg)
stopifnot(length(x$rowValues) == 2, identical(x$cells, matrix(c(.25, .5, .25, 0), 2, 2)))
fa <- function(i = 0, j = 1, probs = NA, states = law1, ...) c(list(states = states_json(states), probs = probs, i = i, j = j), list(...))
thr("finiteLawCells", "i-equals-j", fa(0, 0)); thr("finiteLawCells", "i-out-of-range-n", fa(2, 1)); thr("finiteLawCells", "j-negative", fa(0, -1))
thr("finiteLawCells", "i-non-integer", fa(0.5, 1)); thr("finiteLawCells", "i-missing", list(states = states_json(law1), probs = NA, j = 1))
thr("finiteLawCells", "j-missing", list(states = states_json(law1), probs = NA, i = 0))
thr("finiteLawCells", "criterion-out-of-range-K1", fa(criterion = 1)); thr("finiteLawCells", "criterion-negative", fa(criterion = -1))
thr("finiteLawCells", "criterion-non-integer", fa(criterion = 0.5)); thr("finiteLawCells", "probs-sum.9", fa(probs = vec(c(.3, .3, .3))))
thr("finiteLawCells", "probs-negative", fa(probs = vec(c(-.1, .6, .5)))); thr("finiteLawCells", "probs-length2-S3", fa(probs = vec(c(.5, .5))))
thr("finiteLawCells", "unknown-key-k", list(states = states_json(law1), probs = NA, opts = list(i = 0, j = 1, k = 0)), unknown_key = "k")

# ---- binomialMcse(e, S) = sqrt(e (1 - e) / S) (R7) ------------------------------------------------------------------
o_bm <- function(e, S) sqrt(e * (1 - e) / S)
bm <- function(id, e, S, kind = "case") { v <- o_bm(e, S); add(row(paste0("binomialMcse-", id), "binomialMcse", list(e = xarg(e), S = S), list(mcse = v), kind)); invisible(v) }
eAB <- pnorm((0.95 - 1.2) / sqrt(0.2^2 + 0.2^2)); stopifnot(sprintf("%.17g", eAB) == "0.18837955890579108")   # the spec's e (A above B)
spec_txt(bm("spec-eAB-S1000", eAB, 1000, "example"), "0.012364978798697985", "binomialMcse S 1,000")
spec_txt(bm("spec-eAB-S100", eAB, 100, "example"), "0.03910149622357828", "binomialMcse S 100")
spec_txt(bm("spec-eAB-S4000", eAB, 4000, "example"), "0.0061824893993489925", "binomialMcse S 4,000")
for (S in c(100, 1000, 4000)) bm(sprintf("pin-1.17-released-eAB-S%d", S), e6a[1, 2, 1], S, "pin")
stopifnot(bm("e0", 0, 10, "edge") == 0, bm("e1", 1, 10, "edge") == 0, bm("e.5-S1", .5, 1, "edge") == .5, bm("e.5-S4", .5, 4) == .25)
bm("e.25-S3", .25, 3); bm("tiny-e-1e-12-S1e6", 1e-12, 1e6, "edge"); bm("e.188-S1000", .188, 1000)
thr("binomialMcse", "e-negative", list(e = -.1, S = 100)); thr("binomialMcse", "e-above-1", list(e = 1.1, S = 100))
thr("binomialMcse", "e-NaN", list(e = NUM(NaN), S = 100)); thr("binomialMcse", "S0", list(e = .2, S = 0))
thr("binomialMcse", "S-non-integer", list(e = .2, S = 2.5)); thr("binomialMcse", "S-negative", list(e = .2, S = -3))
thr("binomialMcse", "S-NaN", list(e = .2, S = NUM(NaN))); thr("binomialMcse", "S-Infinity", list(e = .2, S = NUM(Inf)))

# ---- maxCoefficientError(Ehat, E) (R8) ------------------------------------------------------------------------------
o_mce <- function(eh, e) {
  n <- dim(e)[1]; K <- dim(e)[3]
  out <- lapply(seq_len(K), function(k) {
    best <- -Inf; at <- NULL; d_all <- c()
    for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) {
      d <- abs(eh[i, j, k] - e[i, j, k]); d_all <- c(d_all, d)
      if (d > best) { best <- d; at <- list(i = i - 1L, j = j - 1L) }
    }
    list(eps = best, at = at, ties = sum(d_all == best))
  })
  list(epsilon = vec(vapply(out, `[[`, 0, "eps")), at = lapply(out, `[[`, "at"), ties = vapply(out, `[[`, 0L, "ties"))
}
mce <- function(id, eh, e, ids, criteria, kind = "case") {
  r <- o_mce(eh, e)
  add(row(paste0("maxCoefficientError-", id), "maxCoefficientError", list(Ehat = earr(eh, ids, criteria), E = earr(e, ids, criteria)),
          r[c("epsilon", "at")], kind, record = list(pairsAtMax = vec(r$ties)))); invisible(r)
}
x <- mce("spec-two-units", hand2(.25, .75), hand2(.5, .5), c("A", "B"), "score", "example")
stopifnot(identical(unclass(x$epsilon), .25), identical(x$at, list(list(i = 0L, j = 1L))), x$ties == 2)
x <- mce("spec-two-units-swapped", hand2(.5, .5), hand2(.25, .75), c("A", "B"), "score"); stopifnot(identical(x$at, list(list(i = 0L, j = 1L))))
x <- mce("equal-arrays-epsilon0-at-first-pair", e6a, e6a, six$ids, "score_A", "edge"); stopifnot(x$epsilon == 0, identical(x$at, list(list(i = 0L, j = 1L))))
e3h <- hand_e(3, list(c(1, 2, .1, .9), c(1, 3, .2, .8), c(2, 3, .3, .7))); e3x <- hand_e(3, list(c(1, 2, .1, .9), c(1, 3, .2, .8), c(2, 3, .3, .5)))
x <- mce("largest-at-2-1", e3x, e3h, LETTERS[1:3], "score"); stopifnot(identical(x$at, list(list(i = 2L, j = 1L))))
# Exact ties need exact differences (|.6 - .2| is .39999999999999997, not .4): dyadic values give |diff| .375 exactly
# at (0, 2) and at (1, 0); the first in row-major order is (0, 2).
e3d <- hand_e(3, list(c(1, 2, .125, .875), c(1, 3, .25, .75), c(2, 3, .375, .625)))
e3y <- hand_e(3, list(c(1, 2, .125, .5), c(1, 3, .625, .75), c(2, 3, .375, .625)))
x <- mce("tie-first-in-row-major-0-2-before-1-0", e3y, e3d, LETTERS[1:3], "score"); stopifnot(identical(x$at, list(list(i = 0L, j = 2L))), x$ties == 2)
x <- mce("tie-first-in-row-major-swapped", e3d, e3y, LETTERS[1:3], "score"); stopifnot(identical(x$at, list(list(i = 0L, j = 2L))))
x <- mce("K2-per-criterion", array(c(e6ab[, , 1] * 0 + 0.5, e6ab[, , 2]), c(6, 6, 2)), e6ab, six$ids, c("score_A", "score_B"))
stopifnot(x$epsilon[2] == 0, identical(x$at[[2]], list(i = 0L, j = 1L)))
# pins (1.17): drawErrors of gaussianDraws(six sites, sd .2, S, seed 1) against the exact (released) arrays.
gdraws <- function(means, sds, S, seed) {            # z = normals(seed, S n K): draw-major, then unit, then criterion
  n <- nrow(means); K <- ncol(means); z <- prx_normals(seed, S * n * K)
  lapply(seq_len(S) - 1L, function(s) means + sds * matrix(z[s * n * K + seq_len(n * K)], n, K, byrow = TRUE))
}
derr <- function(draws) {                            # share of draws with theta_i <= theta_j, per criterion
  n <- nrow(draws[[1]]); K <- ncol(draws[[1]]); S <- length(draws)
  for (d in draws) for (k in seq_len(K)) stopifnot(min(diff(sort(d[, k]))) > 1e-9)   # no near-ties: the counts are robust
  e <- array(NA_real_, c(n, n, K))
  for (k in seq_len(K)) { cnt <- matrix(0, n, n); for (d in draws) cnt <- cnt + outer(d[, k], d[, k], "<="); m <- cnt / S; diag(m) <- NA; e[, , k] <- m }
  e
}
d100 <- gdraws(cbind(six$mean), matrix(0.2, 6, 1), 100, 1); stopifnot(identical(derr(lapply(d100, r15)), six$drawE1))
mAB <- cbind(six$mean, mB); ehs <- list()
for (S in c(100, 1000, 4000)) for (K in 1:2) {
  means <- mAB[, seq_len(K), drop = FALSE]; crit <- c("score_A", "score_B")[seq_len(K)]
  eh <- derr(gdraws(means, matrix(0.2, 6, K), S, 1)); ehs[[sprintf("S%d-K%d", S, K)]] <- eh
  add(row(sprintf("drawErrorsOfGaussianDraws-pin-1.17-six-%s-S%d-seed1", if (K == 1) "scoreA" else "both-scores", S), "drawErrorsOfGaussianDraws",
          list(means = unname(means), sds = matrix(0.2, 6, K), S = S, seed = 1, ids = vec(six$ids), criteria = vec(crit)),
          list(ids = vec(six$ids), criteria = vec(crit), e = cube_json(eh)), "pin", "existing"))
  ex <- if (K == 1) e6a else e6ab
  mce(sprintf("pin-1.17-six-%s-S%d-seed1", if (K == 1) "scoreA" else "both-scores", S), eh, ex, six$ids, crit, "pin")
}
thr("maxCoefficientError", "n-mismatch", list(Ehat = earr(hand2(.3, .7), c("A", "B"), "score"), E = earr(e3h, LETTERS[1:3], "score")))
thr("maxCoefficientError", "K-mismatch", list(Ehat = earr(e6a, six$ids, "score_A"), E = earr(e6ab, six$ids, c("score_A", "score_B"))))
thr("maxCoefficientError", "n1", list(Ehat = earr(array(NA_real_, c(1, 1, 1)), "A", "score"), E = earr(array(NA_real_, c(1, 1, 1)), "A", "score")))

# ---- chainCountLaw({ p01, p10, S, radius = null }) (R9) -------------------------------------------------------------
o_ccl <- function(p01, p10, S, radius = NULL) {
  pi1 <- p01 / (p01 + p10); pi0 <- 1 - pi1; q01 <- 1 - p01; q10 <- 1 - p10
  f0 <- numeric(S + 1); f1 <- numeric(S + 1); f0[1] <- pi0; f1[2] <- pi1           # f_1(0, 0) = pi0, f_1(1, 1) = pi1
  if (S >= 2) for (t in seq_len(S - 1)) {
    g0 <- f0 * q01 + f1 * p10                                                     # into (c, 0): 0 -> 0 and 1 -> 0
    g1 <- c(0, (f0 * p01 + f1 * q10)[-(S + 1)])                                   # into (c + 1, 1): 0 -> 1 and 1 -> 1
    f0 <- g0; f1 <- g1
  }
  probs <- f0 + f1; out <- NA_real_; margin <- NA_real_
  if (!is.null(radius)) {
    dev <- abs((0:S) / S - pi1); sel <- dev > radius
    out <- ksum(probs[sel]); margin <- min(abs(dev - radius))                     # compensated, in c order
    stopifnot(abs(out - lsum(probs[sel])) <= 1e-15)                               # a plain left-to-right sum agrees
  }
  list(pi1 = pi1, probs = vec(probs), outside = out, margin = margin)
}
ccl <- function(id, p01, p10, S, radius = NULL, kind = "case", radius_null = FALSE, fields = c("pi1", "probs", "outside"), margin = NULL,
                also_pin = FALSE) {
  r <- o_ccl(p01, p10, S, radius)
  if (!is.null(margin)) stopifnot(r$margin > margin)                              # no count near the radius
  a <- list(p01 = xarg(p01), p10 = xarg(p10), S = S); if (!is.null(radius)) a$radius <- xarg(radius); if (radius_null) a$radius <- NA
  rec <- list(radiusMargin = r$margin); if (also_pin) rec$alsoPin <- TRUE
  add(row(paste0("chainCountLaw-", id), "chainCountLaw", a, r[fields], kind, record = rec)); invisible(r)
}
x <- ccl("spec-p01.2-p10.3-S2", .2, .3, 2, kind = "example"); stopifnot(x$pi1 == 0.4, is.na(x$outside))
check_close(x$probs, c(.48, .24, .28), 1e-16, "chainCountLaw: .48, .24, .28")
x <- ccl("spec-p01.01-p10.01-S3", .01, .01, 3, kind = "example"); check_close(x$probs, c(.49005, .00995, .00995, .49005), 1e-16, "stay .99, S 3")
book <- function(S) sqrt(log(4 * 1 * 1 / 0.05) / (2 * S)); pkgr <- function(S) sqrt((log(2) + log(1) - log(0.05)) / (2 * S))
spec_txt(book(100), "0.14802071873008", "book radius S 100"); spec_txt(pkgr(100), "0.135810151574062", "package radius S 100")
spec_txt(book(1000), "0.0468082612082199", "book radius S 1,000")
specv <- list(`stay.99-S100-book` = "0.804345459102859", `stay.99-S100-package` = "0.817706439802635", `stay.99-S1000-book` = "0.770173951294846",
              `stay.5-S100-book` = "0.00351764172297016", `stay.5-S1000-book` = "0.00325259981316338")
for (stay in c(.99, .5)) for (S in c(100, 1000)) for (form in c("book", "package")) {
  p <- if (stay == .99) .01 else .5                                              # p01 = p10 = .01, as the text says
  key <- sprintf("stay%s-S%d-%s", sub("^0", "", format(stay)), S, form)
  x <- ccl(paste0("pin-1.18-", key), p, p, S, if (form == "book") book(S) else pkgr(S), kind = if (is.null(specv[[key]])) "pin" else "example",
           margin = 1e-9, also_pin = !is.null(specv[[key]]))
  if (!is.null(specv[[key]])) spec_close(x$outside, specv[[key]], 1e-14, paste("chainCountLaw outside", key, "(p .01)"))
}
# The printed stay-.99 values are reproduced to the last digit only with p01 = p10 = 1 - .99 = 0.010000000000000009 (and
# a compensated outside sum): the same settings at that p, for an app that forms p as 1 - stay.
for (S in c(100, 1000)) for (form in c("book", "package")) {
  key <- sprintf("stay.99-S%d-%s", S, form)
  x <- ccl(paste0("pin-1.18-p-1-minus-.99-", sub("^stay.99-", "", key)), 1 - .99, 1 - .99, S, if (form == "book") book(S) else pkgr(S), kind = "pin", margin = 1e-9)
  if (!is.null(specv[[key]])) spec_txt(x$outside, specv[[key]], paste("chainCountLaw outside", key, "(p 1 - .99)"))
}
stopifnot(max(abs(o_ccl(.5, .5, 100)$probs - dbinom(0:100, 100, .5))) < 1e-16)    # stay .5 is iid: the binomial law
x <- ccl("swapped-p01.3-p10.2-S2-reversed-probs", .3, .2, 2); check_close(x$probs, c(.28, .24, .48), 1e-16, "swapped p01/p10")
ccl("S1-radius0-both-counts-outside", .3, .6, 1, 0, kind = "edge")
x <- ccl("radius0-exact-hit-excluded", .5, .5, 2, 0, kind = "edge"); stopifnot(x$outside == x$probs[1] + x$probs[3])
x <- ccl("strict-radius.25-hits-excluded", .5, .5, 4, .25); stopifnot(x$outside == x$probs[1] + x$probs[5])
# c/S - pi1 in double: with pi1 = .4 and S = 5, c = 1 gives |.2 - .4| = .2 exactly and c = 3 gives .19999999999999996.
x <- ccl("strict-radius.2-double-arithmetic", .2, .3, 5, .2); stopifnot(x$outside == ksum(x$probs[c(1, 5, 6)]))
stopifnot(sprintf("%.17g", 0.2 - 2^-55) == "0.19999999999999998")              # the double just below .2
x <- ccl("radius-just-below-.2-asymmetric", .2, .3, 5, 0.2 - 2^-55); stopifnot(x$outside == ksum(x$probs[c(1, 2, 5, 6)]))
x <- ccl("alternating-p01-1-p10-1-S4", 1, 1, 4, .1, kind = "edge"); stopifnot(identical(unclass(x$probs), c(0, 0, 1, 0, 0)), x$outside == 0)
x <- ccl("alternating-p01-1-p10-1-S5", 1, 1, 5, kind = "edge"); stopifnot(identical(unclass(x$probs), c(0, 0, .5, .5, 0, 0)))
x <- ccl("radius-null-explicit", .2, .3, 2, radius_null = TRUE); stopifnot(is.na(x$outside))
x <- ccl("large-radius-nothing-outside", .2, .3, 10, 1, kind = "edge"); stopifnot(x$outside == 0)
ccl("p01.02-p10.08-S50-radius.1", .02, .08, 50, .1)
ccl("S5000-stay.99-book", .01, .01, 5000, book(5000), kind = "edge", fields = c("pi1", "outside"), margin = 1e-9)
cc <- function(...) list(...)
thr("chainCountLaw", "p01-0", cc(p01 = 0, p10 = .3, S = 10)); thr("chainCountLaw", "p10-0", cc(p01 = .2, p10 = 0, S = 10))
thr("chainCountLaw", "p01-negative", cc(p01 = -.1, p10 = .3, S = 10)); thr("chainCountLaw", "p01-above-1", cc(p01 = 1.5, p10 = .3, S = 10))
thr("chainCountLaw", "p10-NaN", cc(p01 = .2, p10 = NUM(NaN), S = 10)); thr("chainCountLaw", "S0", cc(p01 = .2, p10 = .3, S = 0))
thr("chainCountLaw", "S5001", cc(p01 = .2, p10 = .3, S = 5001)); thr("chainCountLaw", "S-non-integer", cc(p01 = .2, p10 = .3, S = 2.5))
thr("chainCountLaw", "S-missing", cc(p01 = .2, p10 = .3)); thr("chainCountLaw", "radius-negative", cc(p01 = .2, p10 = .3, S = 10, radius = -.01))
thr("chainCountLaw", "radius-Infinity", cc(p01 = .2, p10 = .3, S = 10, radius = NUM(Inf)))
thr("chainCountLaw", "radius-NaN", cc(p01 = .2, p10 = .3, S = 10, radius = NUM(NaN)))
thr("chainCountLaw", "unknown-key-seed", cc(opts = list(p01 = .2, p10 = .3, S = 10, seed = 1)), unknown_key = "seed")
thr("chainCountLaw", "options-a-number", cc(opts = 5), options_type = TRUE)

# ---- runningMean(trace) (R10) ---------------------------------------------------------------------------------------
o_rm <- function(x) { s <- 0; out <- numeric(length(x)); for (b in seq_along(x)) { s <- s + x[b]; out[b] <- s / b }; out }
rm_row <- function(id, x, kind = "case") { v <- o_rm(x); add(row(paste0("runningMean-", id), "runningMean", list(trace = vec(x)), list(running = vec(v)), kind)); invisible(v) }
stopifnot(identical(rm_row("spec-1-0-0-1", c(1, 0, 0, 1), "example"), c(1, .5, 1/3, .5)))
rm_row("one-value", .3, "edge"); x <- rm_row("ten-times-.1-running-sum-rounds", rep(.1, 10)); stopifnot(x[10] != .1)
rm_row("negatives-and-decimals", c(-.5, .25, 1.75, -2, .125, .3))
o_chain <- function(p01, p10, S, seed) {           # twoStateChain (engine/API.md): X_1 = 1 when u < pi1, then strict moves
  pi1 <- p01 / (p01 + p10); u <- prx_uniforms(seed, S); x <- integer(S); x[1] <- as.integer(u[1] < pi1)
  if (S >= 2) for (b in 2:S) x[b] <- if (x[b - 1] == 0L) as.integer(u[b] < p01) else as.integer(!(u[b] < p10))
  x
}
rm_row("pin-1.18-twoStateChain-p01.01-p10.01-S100-seed1", o_chain(.01, .01, 100, 1), "pin")
rm_row("pin-1.18-twoStateChain-p01.5-p10.5-S100-seed1", o_chain(.5, .5, 100, 1), "pin")
rm_row("bernoulli-uniforms-seed7-S1000", as.numeric(prx_uniforms(7, 1000) < 0.188))
thr("runningMean", "empty", list(trace = I(numeric(0)))); thr("runningMean", "NaN-element", list(trace = list(1, NUM(NaN))))
thr("runningMean", "Infinity-element", list(trace = list(1, NUM(Inf)))); thr("runningMean", "not-an-array", list(trace = 5))

# ==== extensions of existing functions =============================================================================

# ---- disclosure(g): withheld = M - N (R11) --------------------------------------------------------------------------
o_disc <- function(g) {
  n <- length(g); G <- max(g); sizes <- tabulate(g, G); M <- M_of(n); N <- sum(outer(g, g, "<"))
  stopifnot(N == M - sum(choose(sizes, 2)))
  list(M = M, N = N, s = N / M, G = G, sizes = vec(sizes), withheld = M - N)
}
dsc <- function(id, g, kind = "case", pin_old = FALSE) {
  r <- o_disc(g)
  add(row(paste0("disclosure-withheld-", id), "disclosure", list(g = vec(g)), r[c("withheld", "M", "N")], kind))
  if (pin_old) add(row(paste0("disclosure-", id), "disclosure", list(g = vec(g)), r[c("M", "N", "s", "G", "sizes")], "pin", "existing"))
  invisible(r)
}
x <- dsc("spec-112233", c(1, 1, 2, 2, 3, 3), "example"); stopifnot(x$M == 15, x$N == 12, x$withheld == 3)
x <- dsc("pin-1.1-krw-race-card", race_card, "pin", pin_old = TRUE); stopifnot(x$M == 4656, x$N == 1324, x$withheld == 3332)   # catalog 1.1
x <- dsc("pin-1.1-krw-gender-card", gender_card, "pin", pin_old = TRUE); stopifnot(x$N == 731, x$withheld == 3925)
x <- dsc("all-withheld", c(1, 1, 1, 1), "edge"); stopifnot(x$withheld == 6, x$N == 0)
x <- dsc("strict-order", 1:5, "edge"); stopifnot(x$withheld == 0)
dsc("two-units-one-grade", c(1, 1), "edge"); dsc("permuted-labels-312132", c(3, 1, 2, 1, 3, 2))

# ---- leastCertainPairs(E, { k, w, order }): apart = |pos(i) - pos(j)| (R12) ------------------------------------------
o_lcp <- function(e, w = NULL, k = 10, order = NULL) {
  eb <- wsum(e, w); n <- nrow(eb); I <- integer(); J <- integer(); v <- numeric(); ab <- integer(); dd <- numeric()
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    I <- c(I, i); J <- c(J, j); v <- c(v, min(eb[i, j], eb[j, i])); ab <- c(ab, if (eb[i, j] <= eb[j, i]) i else j)
    dd <- c(dd, abs(eb[i, j] - eb[j, i]))
  }
  o <- order(-v, seq_along(v)); kk <- min(k, length(v))
  if (dim(e)[3] > 1) {                         # weighted sums: no last-bit decision at the k-th place or in `above`
    sv <- v[o][seq_len(min(kk + 1, length(v)))]; gaps <- -diff(sv); stopifnot(all(dd == 0 | dd > 1e-14), all(gaps == 0 | gaps > 1e-14))
  }
  o <- o[seq_len(kk)]
  out <- list(count = kk, pairs = lapply(o, function(t) vec(c(I[t], J[t]) - 1L)), e = vec(v[o]), above = vec(ab[o] - 1L))
  if (!is.null(order)) { stopifnot(identical(sort(as.integer(order)), 0:(n - 1)))
    pos <- match(0:(n - 1), order) - 1L; out$apart <- vec(vapply(o, function(t) abs(pos[I[t]] - pos[J[t]]), 0L)) }
  out
}
lcp_ext <- function(id, e, ids, criteria, k = NULL, w = NULL, order = NULL, kind = "case") {
  r <- o_lcp(e, w, if (is.null(k)) 10 else k, order)
  a <- list(E = earr(e, ids, criteria)); if (!is.null(k)) a$k <- k; if (!is.null(w)) a$w <- vec(w); if (!is.null(order)) a$order <- vec(order)
  ex <- if (is.null(order)) list(count = r$count, pairs = r$pairs, apartPresent = FALSE) else list(count = r$count, pairs = r$pairs, apart = r$apart)
  add(row(paste0("leastCertainPairs-apart-", id), "leastCertainPairs", a, ex, kind, if (is.null(order)) "existing" else "step-3.27")); invisible(r)
}
x <- lcp_ext("spec-six-scoreA-k3-order-012435", e6a, six$ids, "score_A", 3, order = c(0, 1, 2, 4, 3, 5), kind = "example")
stopifnot(identical(lapply(x$pairs, unclass), list(c(2L, 3L), c(0L, 1L), c(4L, 5L))), identical(unclass(x$apart), c(2L, 1L, 2L)))
x <- lcp_ext("six-scoreA-k15-identity-order", e6a, six$ids, "score_A", 15, order = 0:5)
stopifnot(identical(unclass(x$apart), vapply(x$pairs, function(p) p[2] - p[1], 0L)))
y <- lcp_ext("six-scoreA-k15-reversed-order", e6a, six$ids, "score_A", 15, order = 5:0); stopifnot(identical(x$apart, y$apart))
lcp_ext("six-AB-w.5-.5-k5-order-102354", e6ab, six$ids, c("score_A", "score_B"), 5, c(.5, .5), order = c(1, 0, 2, 3, 5, 4))
lcp_ext("two-units-order-10", hand2(.3, .7), c("A", "B"), "score", order = c(1, 0), kind = "edge")
lcp_ext("six-scoreA-k3-no-order-no-apart", e6a, six$ids, "score_A", 3, kind = "edge")
xm <- lcp_ext("pin-1.13-league-prior.15-k10-posterior-mean-order", e_lg15, lg$ids, "theta", 10, order = ord15 - 1L, kind = "pin")
xl <- lcp_ext("pin-1.13-league-prior.15-k10-label-order", e_lg15, lg$ids, "theta", 10, order = 0:29, kind = "pin")
stopifnot(sum(unclass(xm$apart) == 1) == 8, max(unclass(xm$apart)) == 2, min(unclass(xl$apart)) > 1, max(unclass(xl$apart)) == 26)   # catalog 1.13
lcp_ext("pin-1.13-six-sites-k10-order", e6a, six$ids, "score_A", 10, order = 0:5, kind = "pin")
lcp_ext("league-prior.15-k10-no-order-no-apart", e_lg15, lg$ids, "theta", 10, kind = "edge")
r <- o_lcp(e_lg15, NULL, 10)                                                     # the pin's existing fields (no order)
add(row("leastCertainPairs-pin-1.13-league-prior.15-k10", "leastCertainPairs", list(E = earr(e_lg15, lg$ids, "theta"), k = 10),
        r[c("count", "pairs", "e", "above")], "pin", "existing"))
lo6 <- function(order) list(E = earr(e6a, six$ids, "score_A"), k = 3, order = vec(order))
thr("leastCertainPairsOrder", "order-repeated-index", lo6(c(0, 0, 1, 2, 3, 4))); thr("leastCertainPairsOrder", "order-length5", lo6(0:4))
thr("leastCertainPairsOrder", "order-index-out-of-range", lo6(c(0, 1, 2, 3, 4, 6))); thr("leastCertainPairsOrder", "order-non-integer", lo6(c(0, 1, 2, 3, 4, 5.5)))

# ---- intervalOverlapTally: amount, nested, nestedCount (R13) --------------------------------------------------------
o_iot <- function(lower, upper) {
  n <- length(lower); P <- list(); am <- c(); ne <- c()
  for (i in 1:(n - 1)) for (j in (i + 1):n) {
    P[[length(P) + 1L]] <- vec(c(i, j) - 1L); am <- c(am, min(upper[i], upper[j]) - max(lower[i], lower[j]))
    ne <- c(ne, (lower[i] <= lower[j] && upper[j] <= upper[i]) || (lower[j] <= lower[i] && upper[i] <= upper[j]))
  }
  list(pairs = P, amount = vec(am), nested = vec(ne), nestedCount = sum(ne))
}
half_pi <- function(n) { p <- matrix(0.5, n, n); diag(p) <- NA; p }
iot <- function(id, lower, upper, pi = NULL, threshold = NULL, kind = "case") {
  r <- o_iot(lower, upper); a <- list(lower = vec(lower), upper = vec(upper), pi = if (is.null(pi)) half_pi(length(lower)) else pi)
  if (!is.null(threshold)) a$threshold <- threshold
  add(row(paste0("intervalOverlapTally-nested-", id), "intervalOverlapTally", a, r, kind)); invisible(r)
}
x <- iot("spec-0-2-1-3-.5-1.5", c(0, 1, .5), c(2, 3, 1.5), kind = "example")
stopifnot(identical(unclass(x$amount), c(1, 1, .5)), identical(unclass(x$nested), c(FALSE, TRUE, FALSE)), x$nestedCount == 1)
x <- iot("equal-intervals-nested", c(0, 0), c(1, 1), kind = "edge"); stopifnot(x$nested, x$amount == 1)
x <- iot("touching-amount0-not-nested", c(0, 1), c(1, 2), kind = "edge"); stopifnot(!x$nested, x$amount == 0)
x <- iot("disjoint-negative-amount", c(0, 2), c(1, 3)); stopifnot(x$amount == -1, !x$nested)
x <- iot("shared-lower-end-nested", c(0, 0), c(2, 1)); stopifnot(x$nested)
x <- iot("shared-upper-end-nested", c(0, 1), c(2, 2)); stopifnot(x$nested)
x <- iot("point-interval-inside-and-at-the-end", c(0, 1, 2), c(2, 1, 2), kind = "edge"); stopifnot(identical(unclass(x$nested), c(TRUE, TRUE, FALSE)))
x <- iot("j-inside-i-and-i-inside-j", c(0, .5, -1), c(3, 2.5, 4)); stopifnot(identical(unclass(x$nested), c(TRUE, TRUE, TRUE)))
x <- iot("decimal-amount-.3-minus-.2", c(.1, .2), c(.3, .5)); stopifnot(x$amount == .3 - .2, x$amount != .1)
o_dm <- function(m, s) { n <- length(m); p <- matrix(NA_real_, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) p[i, j] <- pnorm((m[i] - m[j]) / sqrt(s[i]^2 + s[j]^2)); p }
for (level in c(.90, .95)) {
  zq <- qnorm((1 + level) / 2); lo <- r15(pm15 - zq * sd15); up <- r15(pm15 + zq * sd15)
  x <- iot(sprintf("pin-1.12-league-prior.15-level%s", sub("^0", "", sprintf("%.2f", level))), lo, up, r15(o_dm(pm15, sd15)), .9, kind = "pin")
}
for (level in c(.90, .95)) {                                                     # the six sites' 90% and 95% intervals
  zq <- qnorm((1 + level) / 2); iot(sprintf("six-scoreA-level%s", sub("^0", "", sprintf("%.2f", level))), r15(six$mean - zq * six$sd),
                                    r15(six$mean + zq * six$sd), r15(o_dm(six$mean, six$sd)))
}

# ---- majorityWins: cycleTriples (R14) -------------------------------------------------------------------------------
o_majority <- function(e, w = NULL, tieTol = 1e-12) {
  eb <- wsum(e, w); n <- nrow(eb); beats <- matrix(FALSE, n, n); tie <- matrix(FALSE, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) { beats[i, j] <- eb[i, j] < eb[j, i] - tieTol; tie[i, j] <- abs(eb[i, j] - eb[j, i]) <= tieTol }
  off <- base::row(beats) != base::col(beats); stopifnot(all((beats + t(beats) + tie)[off] == 1))
  d <- abs(eb - t(eb))[off]; stopifnot(all(d == 0 | abs(d - tieTol) > 1e-14))   # no class decided in the last bits
  trip <- list()
  if (n >= 3) { cm <- combn(n, 3)                                                  # columns in lexicographic order
    for (t in seq_len(ncol(cm))) { a <- cm[1, t]; b <- cm[2, t]; c <- cm[3, t]
      if (beats[a, b] && beats[b, c] && beats[c, a]) trip[[length(trip) + 1L]] <- vec(c(a, b, c) - 1L)
      else if (beats[a, c] && beats[c, b] && beats[b, a]) trip[[length(trip) + 1L]] <- vec(c(a, c, b) - 1L) } }
  wins <- rowSums(beats); ties <- rowSums(tie); strict <- !any(tie[off]) && length(trip) == 0
  list(wins = vec(as.integer(wins)), ties = vec(as.integer(ties)), order = vec(order(-wins, seq_len(n)) - 1L),
       cycles = length(trip), strictOrder = strict, cycleTriples = trip)
}
mw <- function(id, e, ids, criteria, w = NULL, tieTol = NULL, kind = "case", pin_old = FALSE) {
  r <- o_majority(e, w, if (is.null(tieTol)) 1e-12 else tieTol)
  a <- list(E = earr(e, ids, criteria)); if (!is.null(w)) a$w <- vec(w); if (!is.null(tieTol)) a$tieTol <- tieTol
  add(row(paste0("majorityWins-cycleTriples-", id), "majorityWins", a, r[c("cycleTriples", "cycles")], kind))
  if (pin_old) add(row(paste0("majorityWins-", id), "majorityWins", a, r[c("wins", "ties", "order", "cycles", "strictOrder")], "pin", "existing"))
  invisible(r)
}
x <- mw("spec-0-beats-1-beats-2-beats-0", hand_e(3, list(c(1, 2, .3, .7), c(2, 3, .3, .7), c(3, 1, .3, .7))), LETTERS[1:3], "score", kind = "example")
stopifnot(identical(lapply(x$cycleTriples, unclass), list(0:2)))
x <- mw("spec-0-beats-2-beats-1-beats-0", hand_e(3, list(c(1, 3, .3, .7), c(3, 2, .3, .7), c(2, 1, .3, .7))), LETTERS[1:3], "score", kind = "example")
stopifnot(identical(lapply(x$cycleTriples, unclass), list(c(0L, 2L, 1L))))
x <- mw("spec-six-scoreA-none", e6a, six$ids, "score_A", kind = "example"); stopifnot(length(x$cycleTriples) == 0)
law_e <- function(states, masses) array(r15(p2$law_counts(states, masses, `<=`) / sum(masses)), c(length(states[[1]]), length(states[[1]]), 1))
x <- mw("condorcet-orders-ABC-BCA-CAB", law_e(list(c(3, 2, 1), c(1, 3, 2), c(2, 1, 3)), c(1, 1, 1)), LETTERS[1:3], "score")
stopifnot(identical(lapply(x$cycleTriples, unclass), list(0:2)))
x <- mw("condorcet-orders-ACB-CBA-BAC", law_e(list(c(3, 1, 2), c(1, 2, 3), c(2, 3, 1)), c(1, 1, 1)), LETTERS[1:3], "score")
stopifnot(identical(lapply(x$cycleTriples, unclass), list(c(0L, 2L, 1L))))
# Four units: 0 > 1 > 2 > 0 and 0 > 1 > 3 > 0 are cyclic; {0, 2, 3} and {1, 2, 3} are not: [[0, 1, 2], [0, 1, 3]].
e4c <- hand_e(4, list(c(1, 2, .3, .7), c(2, 3, .3, .7), c(3, 1, .3, .7), c(2, 4, .3, .7), c(4, 1, .3, .7), c(4, 3, .3, .7)))
x <- mw("four-units-two-cycles", e4c, LETTERS[1:4], "score"); stopifnot(identical(lapply(x$cycleTriples, unclass), list(0:2, c(0L, 1L, 3L))))
# Six units with both orientations and a unit outside every cycle (listed in lexicographic order of the sorted triple).
# Units 0 > 1 > 2 > 0 and 0 > 4 > 3 > 0, 1 and 2 above 3 and 4, 5 above everyone: cyclic {0,1,2} [0, 1, 2], {0,1,3}
# (0 > 1 > 3 > 0) [0, 1, 3] and {0,3,4} written [0, 4, 3] (0 beats 4, 4 beats 3, 3 beats 0).
e6c <- hand_e(6, list(c(1, 2, .3, .7), c(2, 3, .3, .7), c(3, 1, .3, .7), c(1, 5, .3, .7), c(5, 4, .3, .7), c(4, 1, .3, .7),
                      c(2, 4, .4, .6), c(2, 5, .4, .6), c(3, 4, .4, .6), c(3, 5, .4, .6),
                      c(6, 1, .1, .9), c(6, 2, .1, .9), c(6, 3, .1, .9), c(6, 4, .1, .9), c(6, 5, .1, .9)))
x <- mw("six-units-mixed-orientations", e6c, LETTERS[1:6], "score")
stopifnot(identical(lapply(x$cycleTriples, unclass), list(0:2, c(0L, 1L, 3L), c(0L, 4L, 3L))))
e5 <- hand_e(5, list(c(1, 2, 0.3, 0.7), c(2, 3, 0.3, 0.7), c(3, 1, 0.3, 0.7), c(1, 4, 0.2, 0.8), c(2, 4, 0.2, 0.8),
                     c(3, 4, 0.2, 0.8), c(5, 1, 0.1, 0.9), c(5, 2, 0.1, 0.9), c(5, 3, 0.1, 0.9), c(5, 4, 0.1, 0.9)))
x <- mw("cycle-plus-top-and-bottom", e5, LETTERS[1:5], "score"); stopifnot(identical(lapply(x$cycleTriples, unclass), list(0:2)))
e3t <- hand_e(3, list(c(1, 2, 0.3, 0.7), c(2, 3, 0.3, 0.7), c(3, 1, 0.5, 0.5000000000005)))
x <- mw("tie-breaks-cycle", e3t, c("A", "B", "C"), "score", kind = "edge"); stopifnot(length(x$cycleTriples) == 0)
x <- mw("tie-breaks-cycle-tieTol0", e3t, c("A", "B", "C"), "score", tieTol = 0, kind = "edge"); stopifnot(identical(lapply(x$cycleTriples, unclass), list(0:2)))
mw("two-units-none", hand2(.3, .7), c("A", "B"), "score", kind = "edge")
x <- mw("krw-race-none", e_race, krw_ids, "race_signed"); stopifnot(length(x$cycleTriples) == 0)
x <- mw("pin-1.15-krw-gender", e_gender, krw_ids, "gender_signed", kind = "pin", pin_old = TRUE); stopifnot(length(x$cycleTriples) == 1)
x <- mw("pin-1.15-league-prior.15", e_lg15, lg$ids, "theta", kind = "pin", pin_old = TRUE); stopifnot(length(x$cycleTriples) == 0)
mw("six-AB-w.5-.5", e6ab, six$ids, c("score_A", "score_B"), c(.5, .5))

# ---- formatProb(x, { digits, bounds, open }) (R15) ------------------------------------------------------------------
MINUS <- "−"
grp <- function(s) { n <- nchar(s); if (n <= 3) return(s); ch <- strsplit(s, "")[[1]]; out <- character()
  for (i in seq_len(n)) { out <- c(out, ch[i]); left <- n - i; if (left > 0 && left %% 3 == 0) out <- c(out, ",") }; paste(out, collapse = "") }
disp <- function(x, d) {                             # C printf rounding (exact binary value, ties to even), no leading zero below 1
  s <- sprintf(paste0("%.", d, "f"), abs(x)); zero <- grepl("^[0.]+$", s)
  parts <- strsplit(s, ".", fixed = TRUE)[[1]]; ip <- grp(parts[1]); fp <- if (length(parts) > 1) parts[2] else ""
  if (ip == "0" && d > 0) ip <- ""
  out <- if (d > 0) paste0(ip, ".", fp) else ip; if (x < 0 && !zero) out <- paste0(MINUS, out)
  list(text = out, zero = zero, s = s)
}
f_prob <- function(x, digits = 3, bounds = TRUE, open = FALSE) {
  if (is.null(x) || is.list(x) || !is.finite(x)) return("NA")
  lo <- paste0(".", strrep("0", digits - 1), "1"); hi <- paste0(".", strrep("9", digits)); sym <- identical(bounds, "symbols")
  if (isTRUE(open) && !isFALSE(bounds)) {
    if (x == 0) return(if (sym) paste0("<", lo) else paste0("below ", lo))
    if (x == 1) return(if (sym) paste0(">", hi) else paste0("above ", hi))
  }
  if (x == 0) return("0")
  if (x == 1) return("1")
  dd <- disp(x, digits)
  if (!isFALSE(bounds)) {
    if (dd$zero && x > 0) return(if (sym) paste0("<", lo) else paste0("below ", lo))
    if (x < 1 && dd$s == paste0("1.", strrep("0", digits))) return(if (sym) paste0(">", hi) else paste0("above ", hi))
  }
  dd$text
}
fpo <- function(id, x, digits = NULL, bounds = NULL, open = NULL, check = NULL, kind = "case") {
  o <- list(); if (!is.null(digits)) o$digits <- digits; if (!is.null(bounds)) o$bounds <- bounds; if (!is.null(open)) o$open <- open
  t <- f_prob(x, if (is.null(digits)) 3 else digits, if (is.null(bounds)) TRUE else bounds, isTRUE(open))
  if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatProb-open-", id), "formatProb", list(call = if (length(o)) list(x, o) else list(x)), list(text = t), kind,
          if (is.null(open)) "existing" else "step-3.27"))
}
fpo("spec-1-open", 1, open = TRUE, check = "above .999", kind = "example")
fpo("spec-0-open-symbols", 0, bounds = "symbols", open = TRUE, check = "<.001", kind = "example")
fpo("spec-1-open-digits2", 1, digits = 2, open = TRUE, check = "above .99", kind = "example")
fpo("spec-.5-open", .5, open = TRUE, check = ".500", kind = "example")
fpo("spec-1-unchanged", 1, check = "1", kind = "example")
fpo("0-open", 0, open = TRUE, check = "below .001"); fpo("1-open-symbols", 1, bounds = "symbols", open = TRUE, check = ">.999")
fpo("0-open-bounds-false", 0, bounds = FALSE, open = TRUE, check = "0", kind = "edge")
fpo("1-open-bounds-false", 1, bounds = FALSE, open = TRUE, check = "1", kind = "edge")
fpo(".9996-open-rounds-inside", .9996, open = TRUE, check = "above .999"); fpo(".0004-open-rounds-inside", .0004, open = TRUE, check = "below .001")
fpo("0-open-digits2", 0, digits = 2, open = TRUE, check = "below .01"); fpo("0-open-digits4", 0, digits = 4, open = TRUE, check = "below .0001")
fpo("1-open-digits4", 1, digits = 4, open = TRUE, check = "above .9999"); fpo("1-open-digits4-symbols", 1, digits = 4, bounds = "symbols", open = TRUE, check = ">.9999")
fpo(".99991-open-digits4", .99991, digits = 4, open = TRUE, check = ".9999"); fpo(".188-open", .188, open = TRUE, check = ".188")
fpo(".0004-open-digits4", .0004, digits = 4, open = TRUE, check = ".0004"); fpo(".99996-open-digits4", .99996, digits = 4, open = TRUE, check = "above .9999")
fpo("1-open-false", 1, open = FALSE, check = "1", kind = "edge"); fpo("0-open-false", 0, open = FALSE, check = "0", kind = "edge")
fpo("0-open-bounds-true", 0, bounds = TRUE, open = TRUE, check = "below .001")
fpo("1-open-digits1", 1, digits = 1, open = TRUE, check = "above .9", kind = "edge")
add(row("formatProb-open-null-open", "formatProb", list(call = list(NULL, list(open = TRUE))), list(text = "NA"), "edge"))
add(row("formatProb-open-1-default-digits2", "formatProb", list(call = list(1, list(digits = 2))), list(text = "1"), "case", "existing"))

# ==== read-out pins: existing functions at the apps' settings ======================================================
pin <- function(id, fn, args, expect, needs = "existing") add(row(paste0(fn, "-pin-", id), fn, args, expect, "pin", needs))
# 1.2 simulateEstimates(.5, .2, 20, 2) = .5 + .2 normals(2, 20)
pin("1.2-truth.5-se.2-n20-seed2", "simulateEstimates", list(truth = .5, se = .2, count = 20, seed = 2), list(estimates = vec(.5 + .2 * prx_normals(2, 20))))
# 1.4 leagueOvershoot(20261029, ...): replays r = 1..R use drawLeague(20261029 + r); 2,000 draws = seeds 20261030 ... 20263029.
D <- lapply(seq_len(2000), function(r) { est <- draw(20261029 + r); gap_ok(est); est })
o_lov <- function(R, k, side, sigma) {
  d <- lapply(seq_len(R), function(r) { est <- D[[r]]; ord <- order(-est, seq_len(30))
    u <- if (side == "top") ord[seq_len(k)] else ord[(31 - k):30]; pm <- post(est, sigma)$mean
    list(units = vec(u - 1L), ov = lsum(est[u] - lg$theta[u]) / k, pv = lsum(pm[u] - lg$theta[u]) / k) })
  ov <- vapply(d, `[[`, 0, "ov"); pv <- vapply(d, `[[`, 0, "pv")
  stopifnot(abs(lsum(ov) - ksum(ov)) / R < 1e-15, abs(lsum(pv) - ksum(pv)) / R < 1e-15)   # plain and compensated means agree
  list(seed = 20261029, replays = R, k = k, side = side, priorSd = sigma, r = vec(seq_len(R)), seeds = vec(20261029 + seq_len(R)),
       units = lapply(d, `[[`, "units"), overshoot = vec(ov), posteriorOvershoot = vec(pv), mean = list(overshoot = ksum(ov) / R, posteriorOvershoot = ksum(pv) / R))
}
lov_try <- list()
for (cfg in list(list(2000, 3, "bottom", .15), list(2000, 3, "top", .05), list(2000, 3, "top", .10), list(2000, 1, "top", .15),
                 list(2000, 10, "top", .15), list(20, 3, "top", .15))) {
  r <- o_lov(cfg[[1]], cfg[[2]], cfg[[3]], cfg[[4]]); key <- sprintf("R%d-k%d-%s-prior%s", cfg[[1]], cfg[[2]], cfg[[3]], sub("^0", "", format(cfg[[4]])))
  lov_try[[key]] <- r$mean
  pin(paste0("1.4-seed20261029-", key), "leagueOvershoot", list(seed = 20261029, replays = cfg[[1]], k = cfg[[2]], side = cfg[[3]], priorSd = cfg[[4]]),
      if (cfg[[1]] == 20) r else r[c("seed", "replays", "k", "side", "priorSd", "units", "overshoot", "posteriorOvershoot", "mean")])
}
check_close(c(lov_try[["R2000-k3-bottom-prior.15"]], lov_try[["R2000-k3-top-prior.05"]]$posteriorOvershoot, lov_try[["R2000-k3-top-prior.1"]]$posteriorOvershoot,
              lov_try[["R2000-k1-top-prior.15"]], lov_try[["R2000-k10-top-prior.15"]]$overshoot),
            c(-.150, -.013, -.131, -.063, .220, -.024, .081), 5e-4, "1.4 catalog values (-.150, -.013; -.131; -.063; .220, -.024; .081)")
# 1.5 / 1.6: the frozen draw's teaching posterior at prior SD sigma (prior mean 0) against theta
pmv <- function(sigma) r15(post(est0, sigma)$mean)
for (s in c(.02, .04, .45)) pin(sprintf("1.5-1.6-league-seed20261030-postmean-prior%s-vs-theta", sub("^0", "", format(s))), "meanSquaredDistance",
                                list(a = vec(pmv(s)), b = vec(th15)), list(value = mean((pmv(s) - th15)^2)))
check_close(mean((pmv(.02) - th15)^2), .0197, 5e-5, "1.5 too-narrow: .0197")
o_esd <- function(theta, se, sigma) { B <- sigma^2 / (sigma^2 + se^2); per <- ((1 - B) * (0 - theta))^2 + B^2 * se^2
  list(perUnit = vec(per), mean = ksum(per) / length(theta), rawMean = ksum(se^2) / length(theta)) }
for (s in c(.05, .45)) pin(sprintf("1.6-league-prior%s", sub("^0", "", format(s))), "expectedSquaredDistance", list(theta = vec(th15), se = vec(lg$se), priorSd = s), o_esd(th15, lg$se, s))
check_close(c(o_esd(th15, lg$se, .45)$mean, o_esd(th15, lg$se, .02)$mean), c(.0133, .0191), 5e-5, "1.6: .0133 (prior .45), .0191 (.02)")
o_pc <- function(e, thresholds = c(.9, .99)) { eb <- e[, , 1]; n <- nrow(eb); v <- c()
  for (i in 1:(n - 1)) for (j in (i + 1):n) v <- c(v, min(eb[i, j], eb[j, i]))
  for (t in thresholds) stopifnot(all(abs(v - (1 - t)) > 1e-14))
  list(M = M_of(n), thresholds = vec(thresholds), counts = vec(vapply(thresholds, function(t) sum(v < 1 - t), 0L))) }
pc_try <- c()
for (s in c(.02, .05, .45, Inf)) {
  q <- post(est0, s); e <- array(r15(err_normal(q$mean, q$sd)), c(30, 30, 1)); r <- o_pc(e); pc_try <- c(pc_try, as.integer(unclass(r$counts)[1]))
  pin(sprintf("1.6-league-seed20261030-prior%s", if (is.infinite(s)) "-flat" else sub("^0", "", format(s))), "pairCertainty", list(E = earr(e, lg$ids, "theta")), r)
}
stopifnot(identical(pc_try, c(6L, 66L, 159L, 172L)))                              # catalog 1.6: 6, 66, 159 of the 435 pairs
pm45 <- pmv(.45); dfar <- abs(pm45 - th15) - abs(est0 - th15); stopifnot(all(abs(dfar) > 1e-9))
f45 <- abs(pm45 - th15) > abs(est0 - th15)
pin("1.6-league-seed20261030-prior.45", "fartherCount", list(estimates = vec(est0), posteriorMeans = vec(pm45), truth = vec(th15)),
    list(count = sum(f45), units = vec(which(f45) - 1L), flags = vec(f45))); stopifnot(sum(f45) == 13)
gap_ok(pm45); gap_ok(th15); mis45 <- 0; for (i in 1:29) for (j in (i + 1):30) mis45 <- mis45 + ((pm45[i] - pm45[j]) * (th15[i] - th15[j]) < 0)
pin("1.6-league-seed20261030-postmean-prior.45-vs-theta", "misorderedPairs", list(a = vec(pm45), b = vec(th15)), list(count = mis45))
o_emp <- function(theta, se, sigma) { B <- sigma^2 / (sigma^2 + se^2); s <- 0
  for (i in 1:29) for (j in (i + 1):30) { sg <- sign(theta[i] - theta[j]); s <- s + pnorm(-sg * (B[i] * theta[i] - B[j] * theta[j]) / sqrt(B[i]^2 * se[i]^2 + B[j]^2 * se[j]^2)) }
  s }
for (s in c(.14, .45)) pin(sprintf("1.6-league-prior%s", sub("^0", "", format(s))), "expectedMisorderedPairs", list(theta = vec(th15), se = vec(lg$se), priorSd = s),
                           list(expected = o_emp(th15, lg$se, s)))
check_close(o_emp(th15, lg$se, .14), 80.66, 5e-3, "1.6 too-narrow: 80.66 at prior SD .14")
# 1.7 chain presets: estimates (.25, .05), SEs (.10, .20), prior SD .15 and .05; the pair's error e(A above B) and pi
for (s in c(.15, .05)) {
  est <- c(.25, .05); se <- c(.10, .20); B <- s^2 / (s^2 + se^2); m <- 0 + B * (est - 0); sd <- sqrt(B) * se
  lab <- sub("^0", "", format(s))
  pin(paste0("1.7-chain-prior", lab), "normalPosterior", list(est = vec(est), se = vec(se), priorMean = 0, priorSd = s), list(mean = vec(m), sd = vec(sd), shrink = vec(B)))
  mr <- r15(m); sr <- r15(sd); e2 <- err_normal(mr, sr)
  pin(paste0("1.7-chain-prior", lab, "-posterior-pair"), "errorArray", list(means = matrix(mr, 2, 1), sds = matrix(sr, 2, 1), ids = vec(c("A", "B")), criteria = vec("score")),
      list(ids = vec(c("A", "B")), criteria = vec("score"), e = cube_json(array(e2, c(2, 2, 1)))))
  pin(paste0("1.7-chain-prior", lab, "-posterior-pair"), "pairDirection", list(meanA = mr[1], sdA = sr[1], meanB = mr[2], sdB = sr[2]), list(pi = pnorm((mr[1] - mr[2]) / sqrt(sr[1]^2 + sr[2]^2))))
  check_close(e2[1, 2], if (s == .15) .144 else .238, 5e-4, "1.7: e(A above B) .144 (prior .15) and .238 (.05)")
}
# 1.10 finite laws on (A, B) values 0, 1, 2 (equal state weights: probs null) and the two-bump mixture
o_fl <- function(states, probs = NULL) {
  S <- length(states); n <- nrow(states[[1]]); w <- if (is.null(probs)) rep(1, S) else probs; den <- if (is.null(probs)) S else 1
  cnt <- function(rel) { a <- matrix(NA_real_, n, n); for (i in 1:n) for (j in 1:n) if (i != j) a[i, j] <- sum(w[vapply(states, function(s) rel(s[i, 1], s[j, 1]), TRUE)]) / den; a }
  list(pi = cnt(`>`), e = cnt(`<=`), t = cnt(`==`), b = cnt(`<`), d = { eq <- cnt(`==`); 1 - eq })
}
for (lw in list(list("independence", lawI), list("always-equal", lawE))) {
  L <- o_fl(lw[[2]])
  pin(paste0("1.10-", lw[[1]]), "finiteLawPairwise", list(states = states_json(lw[[2]]), probs = NA, ids = vec(c("A", "B")), criteria = vec("score")),
      list(pi = cube_json(array(L$pi, c(2, 2, 1))), e = cube_json(array(L$e, c(2, 2, 1))), t = cube_json(array(L$t, c(2, 2, 1)))))
}
L2 <- o_fl(law2); L2d <- { m <- matrix(NA_real_, 2, 2); m[1, 2] <- m[2, 1] <- 1 - 0; m }
stopifnot(all(L2$t == 0, na.rm = TRUE))                                           # law 2 has no ties: d = 1 exactly
pin("1.10-law2", "tieLawPairwise", list(states = states_json(law2), probs = NA, ids = vec(c("A", "B")), criteria = vec("score")),
    list(b = cube_json(array(L2$b, c(2, 2, 1))), t = cube_json(array(L2$t, c(2, 2, 1))), d = cube_json(array(L2d, c(2, 2, 1)))))
V1 <- rbind(c(0, 1), c(1, 2), c(2, 0)); R1 <- t(apply(V1, 1, function(v) vapply(v, function(u) 1 + sum(v > u), 0)))
pin("1.10-law1", "rankSummaries", list(law = list(states = lapply(1:3, function(s) vec(V1[s, ])), probs = NA)),
    list(means = vec(colSums(V1) / 3), expectedRank = vec(colSums(R1) / 3), pTop = unname(rbind(colSums(R1 <= 1) / 3, colSums(R1 <= 2) / 3))))
cmp <- function(w, mA, sA, mB, sB) list(w = w, meanA = mA, sdA = sA, meanB = mB, sdB = sB, corr = 0)
for (wh in c(.05, .10, .30, .35, .95)) {
  wl <- 1 - wh; comps <- list(cmp(xarg(wl), -.1, .1, 0, .1), cmp(wh, 1, .1, 0, .1))
  pin(sprintf("1.10-upper-bump-weight%s", sub("^0", "", sprintf("%.2f", wh))), "mixturePairDirection", list(components = comps),
      list(pi = wl * pnorm((-.1 - 0) / sqrt(.1^2 + .1^2)) + wh * pnorm((1 - 0) / sqrt(.1^2 + .1^2))))
}
# 1.14 transformedMeans on the league posterior at prior SD .15: exp(k theta) with k = 10 (lognormal means)
tmv <- exp(10 * pm15 + 10^2 * sd15^2 / 2); stv <- sort(tmv); stopifnot(all(diff(stv) > 1e-12 * pmax(1, stv[-1])))
pin("1.14-league-prior.15-exp-k10", "transformedMeans", list(law = list(means = vec(pm15), sds = vec(sd15)), transform = "exp", k = 10),
    list(means = vec(tmv), order = vec(order(-tmv, seq_len(30)) - 1L)))
# 1.17 envelopeRadius(15, S, .05, "package") = sqrt((log 2 + log M - log alpha)/(2 S)); 1.18 the chain's M = 1 radii
for (S in c(100, 1000, 4000)) pin(sprintf("1.17-M15-S%d-alpha.05-package", S), "envelopeRadius", list(M = 15, S = S, alpha = .05, form = "package"),
                                  list(radius = sqrt((log(2) + log(15) - log(.05)) / (2 * S))))
for (S in c(100, 1000)) {
  pin(sprintf("1.18-M1-S%d-alpha.05-book", S), "envelopeRadius", list(M = 1, S = S, alpha = .05, form = "book"), list(radius = book(S)))
  pin(sprintf("1.18-M1-S%d-alpha.05-package", S), "envelopeRadius", list(M = 1, S = S, alpha = .05, form = "package"), list(radius = pkgr(S)))
}

# ---- write ----------------------------------------------------------------------------------------------------------
json_safe <- function(x, where) {                    # every numeric input survives the 15-digit JSON text (or is a token)
  if (is.list(x)) { if (!is.null(x[["$sum"]]) || !is.null(x[["$num"]])) return(invisible(TRUE)); for (y in x) json_safe(y, where); return(invisible(TRUE)) }
  if (is.numeric(x)) {
    v <- as.numeric(x); if (any(is.infinite(v))) stop("infinite input (use a token): ", where, call. = FALSE)
    v <- v[!is.na(v)]; if (length(v) && !safe15(v)) stop("input not 15-digit safe: ", where, call. = FALSE)
  }
  invisible(TRUE)
}
no_inf <- function(x, where) {
  if (is.list(x)) { for (y in x) no_inf(y, where); return(invisible(TRUE)) }
  if (is.numeric(x) && any(is.infinite(x))) stop("infinite expected value: ", where, call. = FALSE)
  invisible(TRUE)
}
for (r in rows) { json_safe(r$args, r$id); no_inf(r$expect, r$id) }
ids <- vapply(rows, `[[`, "", "id"); stopifnot(!anyDuplicated(ids))
new_fns <- c("pairDifference", "normalCoverage", "withinBand", "sharedMeanPosterior", "claimsByDistance", "finiteLawCells", "binomialMcse",
             "maxCoefficientError", "chainCountLaw", "runningMean")
ext_fns <- c("disclosure", "leastCertainPairs", "intervalOverlapTally", "majorityWins", "formatProb")
pin_fns <- c("simulateEstimates", "leagueOvershoot", "meanSquaredDistance", "expectedSquaredDistance", "pairCertainty", "fartherCount",
             "misorderedPairs", "expectedMisorderedPairs", "normalPosterior", "errorArray", "pairDirection", "finiteLawPairwise",
             "tieLawPairwise", "rankSummaries", "mixturePairDirection", "transformedMeans", "drawErrorsOfGaussianDraws", "envelopeRadius")
used <- vapply(rows, function(r) r$args$fn, "")
known <- c(new_fns, ext_fns, pin_fns, paste0(c(new_fns, "leastCertainPairsOrder"), "Throws"))
stopifnot(all(new_fns %in% used), all(ext_fns %in% used), all(used %in% known))
for (f in new_fns) stopifnot(paste0(f, "Throws") %in% used)
assert_no_postrank()
write_golden("oracle-v3p1", rows, generator = "r-export/18_v3_part1.R", uses_postrank = FALSE)
kind <- vapply(rows, function(r) r$record$kind, ""); needs <- vapply(rows, function(r) r$record$needs, "")
base_fn <- sub("Throws$", "", sub("^leastCertainPairsOrder", "leastCertainPairs", used))
cat("oracle-v3p1:", length(rows), "rows\n")
print(table(fn = factor(base_fn, levels = unique(c(new_fns, ext_fns, pin_fns))), kind = factor(kind, levels = c("example", "case", "edge", "throw", "pin"))))
print(table(needs))
if (length(spec_notes)) cat("specification examples within 2 ulps but not to the printed digit:\n", paste0("  ", spec_notes, "\n"), sep = "")
