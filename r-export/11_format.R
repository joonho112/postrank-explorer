# Author: JoonHo Lee (jlee296@ua.edu)
# Golden values for engine/src/format.ts and erfc (engine/src/special.ts) (Step 2.12).
#   oracle-format  base R only: display strings built from R's sprintf (C printf: the exact binary value is rounded,
#                  ties to even) and the display rules of engine/README.md "format.ts: display rules" (no leading zero
#                  below 1, U+2212 minus, thousands separators, exact ends 0 and 1, "below .001" / "above .999",
#                  "NA" and "NA: no disclosure"), the README's worked examples, rationalApprox against a brute-force
#                  search over denominators, and erfc against mpmath at 50 digits (python3; the fallback
#                  2 pnorm(-sqrt(2) x) is used only for |x| <= 5 when mpmath is missing). postrank is not loaded.
# Every row calls one exported function with positional arguments args$call. JSON cannot hold NaN, Infinity,
# BigInt, undefined or a function, so these are tokens decoded by the adapter: {"$num": "NaN" | "Infinity" |
# "-Infinity"}, {"$bigint": "<digits>"}, {"$undef": true}, {"$fn": "<export name>"}, and {"$sum": [a, b]} for a + b
# formed in double precision (so that values one ulp off a decimal, such as 0.1 + 0.2, survive the 15-digit JSON).
# Only behaviour the README fixes is tested; open conventions (for example a positive exponent in formatSci's "e"
# style, or per-element decimals in a weight vector) are left out on purpose.
source("r-export/_paths.R"); source("r-export/_helpers.R"); source("r-export/_oracle.R")
assert_no_postrank()

vec <- function(x) I(unname(x))
row <- function(id, fn, args, expect) list(id = id, args = c(list(fn = fn), args), expect = expect)
rows <- list()
add <- function(r) rows[[length(rows) + 1L]] <<- r
NaN_ <- list(`$num` = "NaN"); Inf_ <- list(`$num` = "Infinity"); NInf_ <- list(`$num` = "-Infinity"); UNDEF <- list(`$undef` = TRUE)
SUM <- function(a, b) list(`$sum` = vec(c(a, b)))
BIG <- function(s) list(`$bigint` = s)
FN <- function(name) list(`$fn` = name)
MINUS <- "−"

# ---- display primitives (README rules) ------------------------------------------------------------------------------
is_na_arg <- function(x) is.null(x) || is.list(x) || !is.finite(x)          # null, NaN, +-Infinity tokens -> "NA"
grp <- function(s) {                                                         # thousands separators in an integer string
  n <- nchar(s); if (n <= 3) return(s)
  ch <- strsplit(s, "")[[1]]; out <- character()
  for (i in seq_len(n)) { out <- c(out, ch[i]); left <- n - i; if (left > 0 && left %% 3 == 0) out <- c(out, ",") }
  paste(out, collapse = "")
}
# x rounded to d places by C printf (exact binary value, ties to even); leading zero dropped below 1 unless asked.
disp <- function(x, d, leading_zero = FALSE, group = TRUE) {
  s <- sprintf(paste0("%.", d, "f"), abs(x)); zero <- grepl("^[0.]+$", s)
  parts <- strsplit(s, ".", fixed = TRUE)[[1]]; ip <- parts[1]; fp <- if (length(parts) > 1) parts[2] else ""
  if (group) ip <- grp(ip)
  if (!leading_zero && ip == "0" && d > 0) ip <- ""
  out <- if (d > 0) paste0(ip, ".", fp) else ip
  if (x < 0 && !zero) out <- paste0(MINUS, out)
  list(text = out, zero = zero, s = s)
}
f_bounded <- function(x, digits, bounds) {                                   # probabilities, shares and risks in (0, 1)
  if (is_na_arg(x)) return("NA")
  if (x == 0) return("0")
  if (x == 1) return("1")
  dd <- disp(x, digits)
  if (!isFALSE(bounds)) {
    lo <- paste0(".", strrep("0", digits - 1), "1"); hi <- paste0(".", strrep("9", digits))
    sym <- identical(bounds, "symbols")
    if (dd$zero && x > 0) return(if (sym) paste0("<", lo) else paste0("below ", lo))
    if (x < 1 && dd$s == paste0("1.", strrep("0", digits))) return(if (sym) paste0(">", hi) else paste0("above ", hi))
  }
  dd$text
}
f_prob <- function(x, digits = 3, bounds = TRUE) f_bounded(x, digits, bounds)
f_risk <- function(x, digits = 4, bounds = TRUE) f_bounded(x, digits, bounds)
f_decimal <- function(x, digits = 2, leadingZero = FALSE, group = TRUE) if (is_na_arg(x)) "NA" else disp(x, digits, leadingZero, group)$text
f_sig <- function(x, sig = 3) {
  if (is_na_arg(x)) return("NA")
  if (x == 0) return("0")
  m <- sprintf(paste0("%.", sig - 1, "e"), abs(x)); e <- as.integer(sub(".*e", "", m)); places <- sig - 1 - e
  if (places >= 0) return(disp(x, places)$text)                              # %f at the same rounding position as %e
  txt <- grp(paste0(gsub("[.]|e.*", "", m), strrep("0", -places)))
  if (x < 0) paste0(MINUS, txt) else txt
}
SUP <- c(`0` = "⁰", `1` = "¹", `2` = "²", `3` = "³", `4` = "⁴", `5` = "⁵", `6` = "⁶",
         `7` = "⁷", `8` = "⁸", `9` = "⁹")
f_sci <- function(x, sig = 3, trim = FALSE, style = "e") {
  m <- sprintf(paste0("%.", sig - 1, "e"), abs(x)); mant <- sub("e.*", "", m); ex <- as.integer(sub(".*e", "", m))
  if (trim && grepl(".", mant, fixed = TRUE)) mant <- sub("\\.$", "", sub("0+$", "", mant))
  sgn <- if (x < 0) MINUS else ""
  if (style == "e") { stopifnot(ex < 0); return(paste0(sgn, mant, "e", MINUS, abs(ex))) }        # README: 1.39e-17
  stopifnot(ex > 0); paste0(sgn, mant, " × 10", paste(SUP[strsplit(as.character(ex), "")[[1]]], collapse = ""))
}
f_percent <- function(x, digits = 0, bounds = TRUE) {
  if (is_na_arg(x)) return("NA")
  if (x == 0) return("0%")
  if (x == 1) return("100%")
  s <- sprintf(paste0("%.", digits + 2, "f"), x)                             # rounding on the exact share
  parts <- strsplit(s, ".", fixed = TRUE)[[1]]
  pint <- sub("^0+(?=.)", "", paste0(parts[1], substr(parts[2], 1, 2)), perl = TRUE); pdec <- substring(parts[2], 3)
  txt <- if (digits > 0) paste0(pint, ".", pdec) else pint
  if (bounds) {
    stopifnot(digits == 0)                                                   # README: "below 1%" at the default digits
    if (txt == "0") return("below 1%")
    if (txt == "100") return("above 99%")
  }
  paste0(txt, "%")
}
f_count <- function(n) { n <- val(n); s <- if (is.list(n)) n$`$bigint` else sprintf("%.0f", abs(n)); neg <- !is.list(n) && n < 0; paste0(if (neg) MINUS else "", grp(s)) }
gcd <- function(a, b) { a <- abs(a); b <- abs(b); while (b > 0) { t <- a %% b; a <- b; b <- t }; a }
f_fraction <- function(num, den) {
  if (den == 0) return("NA")
  if (num == 0) return("0")
  g <- gcd(num, den); p <- abs(num) / g; q <- abs(den) / g; sgn <- if ((num < 0) != (den < 0)) MINUS else ""
  if (q == 1) paste0(sgn, sprintf("%.0f", p)) else paste0(sgn, sprintf("%.0f/%.0f", p, q))
}
o_rational <- function(x, maxDenominator = 1000, tolerance = 1e-12) {        # smallest q <= maxDen with |x - p/q| <= tol
  hits <- list()
  for (q in seq_len(maxDenominator)) { p <- round(x * q); if (abs(x - p / q) <= tolerance) hits[[length(hits) + 1L]] <- c(p, q) }
  if (!length(hits)) return(NULL)
  red <- unique(lapply(hits, function(h) { g <- gcd(h[1], h[2]); if (g == 0) c(0, 1) else h / g }))
  stopifnot(length(red) == 1L)                                               # the answer does not depend on the search
  list(num = red[[1]][1], den = red[[1]][2])
}
f_ratio <- function(num, den, digits = 3, sig = NULL, bounds = TRUE) if (den == 0) "NA" else if (!is.null(sig)) f_sig(num / den, sig) else f_prob(num / den, digits, bounds)
f_eovern <- function(E, N, digits = 3, bounds = TRUE) if (N == 0) "NA: no disclosure" else f_prob(E / N, digits, bounds)
f_signed <- function(x, digits = 3, sig = NULL) {
  if (is_na_arg(x)) return("NA")
  if (x == 0) return("0")
  if (!is.null(sig)) { s <- f_sig(abs(x), sig); return(paste0(if (x < 0) MINUS else "+", s)) }
  dd <- disp(abs(x), digits)
  if (dd$zero) return(dd$text)                                               # a displayed zero carries no sign
  paste0(if (x < 0) MINUS else "+", dd$text)
}
# formatSetting: a scalar as the shortest decimal with at least two places equal to it within 1e-12 (the cases here
# need at most three places), else a fraction with denominator <= 12, else four decimals; integers plainly (no
# grouping). A weight vector in fractions when every weight is k/q with q in {1, 2, 3, 4, 6, 8, 12}, else decimals
# (the cases here have the same number of places in every element).
frac_of <- function(x, qs) { for (q in qs) { p <- round(x * q); if (abs(x - p / q) <= 1e-12) return(c(p, q)) }; NULL }
f_setting <- function(v) {
  if (length(v) > 1) {
    fr <- lapply(v, frac_of, qs = c(1, 2, 3, 4, 6, 8, 12))
    if (all(!vapply(fr, is.null, TRUE))) return(paste0("(", paste(vapply(fr, function(f) f_fraction(f[1], f[2]), ""), collapse = ", "), ")"))
    places <- vapply(v, function(x) { for (p in 1:6) if (abs(as.numeric(sprintf(paste0("%.", p, "f"), x)) - x) <= 1e-12) return(p); NA_real_ }, 0)
    stopifnot(!anyNA(places), length(unique(places)) == 1L)
    return(paste0("(", paste(vapply(v, function(x) disp(x, places[1], group = FALSE)$text, ""), collapse = ", "), ")"))
  }
  if (v == round(v)) return(sprintf("%.0f", v))
  for (p in 2:3) if (abs(as.numeric(sprintf(paste0("%.", p, "f"), v)) - v) <= 1e-12) return(disp(v, p, group = FALSE)$text)
  for (p in 4:11) if (abs(as.numeric(sprintf(paste0("%.", p, "f"), v)) - v) <= 1e-12) stop("formatSetting case needs more than three places")
  f <- frac_of(v, 1:12); if (!is.null(f)) return(f_fraction(f[1], f[2]))
  disp(v, 4, group = FALSE)$text
}
val <- function(x) if (is.list(x) && !is.null(x$`$sum`)) sum(unlist(x$`$sum`)) else x   # decode $sum for R-side use

# ---- formatProb -----------------------------------------------------------------------------------------------------
pr <- function(id, x, opts = NULL, text) {
  a <- if (is.null(opts)) list(x) else list(x, opts)
  add(row(paste0("formatProb-", id), "formatProb", list(call = a), list(text = text)))
}
fp <- function(id, x, digits = NULL, bounds = NULL, check = NULL) {
  o <- list(); if (!is.null(digits)) o$digits <- digits; if (!is.null(bounds)) o$bounds <- bounds
  t <- f_prob(val(x), if (is.null(digits)) 3 else digits, if (is.null(bounds)) TRUE else bounds)
  if (!is.null(check)) stopifnot(identical(t, check))
  pr(id, x, if (length(o)) o else NULL, t)
}
# README examples and its rounding table (exact ties go to the even neighbour; decimal look-alikes are not ties).
fp("readme-.1875", 0.1875, check = ".188"); fp("readme-.0625", 0.0625, check = ".062"); fp("readme-.0005", 0.0005, check = ".001")
fp("readme-1.0005", 1.0005, check = "1.000"); fp("readme-.812", 0.812, check = ".812"); fp("readme-0", 0, check = "0")
fp("readme-1", 1, check = "1"); fp("readme-below", 0.0004, check = "below .001"); fp("readme-above", 0.9996, check = "above .999")
fp("readme-digits4", 0.99991, digits = 4, check = ".9999")
for (x in c(0.188, 0.5, 0.0015, 0.0025, 0.1245, 0.1255, 0.01, 0.999, 0.9995, 0.0005000001, 1e-10, 0.05, 0.3333333333333333, 2/3))
  fp(sprintf("%.17g", x), x)
for (d in c(1, 2, 4, 5)) for (x in c(0.15, 0.25, 0.0625, 0.123456, 0.00004)) fp(sprintf("%.17g-digits%d", x, d), x, digits = d)
fp("0.1+0.2", SUM(0.1, 0.2))
fp("symbols-below", 0.0004, bounds = "symbols", check = "<.001"); fp("symbols-above", 0.9996, bounds = "symbols", check = ">.999")
fp("nobounds-below", 0.0004, bounds = FALSE, check = ".000"); fp("nobounds-above", 0.9996, bounds = FALSE, check = "1.000")
fp("negative-.0227", -0.0227, check = paste0(MINUS, ".023"))
pr("null", NULL, NULL, "NA"); pr("NaN", NaN_, NULL, "NA"); pr("Infinity", Inf_, NULL, "NA"); pr("-Infinity", NInf_, NULL, "NA")
pr("undefined", UNDEF, NULL, "NA")

# ---- formatRisk -----------------------------------------------------------------------------------------------------
rk <- function(id, x, digits = NULL, check = NULL) {
  t <- f_risk(val(x), if (is.null(digits)) 4 else digits); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatRisk-", id), "formatRisk", list(call = if (is.null(digits)) list(x) else list(x, list(digits = digits))), list(text = t)))
}
rk("readme-.0417", 0.0416516399454871, check = ".0417"); rk("readme-.0248", 0.0248, check = ".0248")
rk("readme-1.8288", 1.82881, check = "1.8288"); rk("readme-negative", -0.02274, check = paste0(MINUS, ".0227"))
rk("readme-below", 0.00001, check = "below .0001"); rk("zero", 0, check = "0")
for (x in c(0.15, 11/60, 0.063774, 0.00005, 0.00015, 12.34565, 1249.5)) rk(sprintf("%.17g", x), x)
rk("digits3-.0625", 0.0625, digits = 3); rk("digits2-.375", 0.375, digits = 2)
add(row("formatRisk-null", "formatRisk", list(call = list(NULL)), list(text = "NA")))

# ---- formatDecimal --------------------------------------------------------------------------------------------------
dc <- function(id, x, opts = list(), check = NULL) {
  t <- do.call(f_decimal, c(list(val(x)), opts)); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatDecimal-", id), "formatDecimal", list(call = if (length(opts)) list(x, opts) else list(x)), list(text = t)))
}
dc("readme-13.65", 13.649, check = "13.65"); dc("readme-1249.5", 1249.5, list(digits = 1), check = "1,249.5")
dc("readme-2.675", 2.675, check = "2.67"); dc("half", 0.5, check = ".50"); dc("half-leadingZero", 0.5, list(leadingZero = TRUE), check = "0.50")
dc("negative-millions", -1234567.891, check = paste0(MINUS, "1,234,567.89")); dc("nogroup", 1234.5, list(group = FALSE), check = "1234.50")
dc("digits0", 1234.5, list(digits = 0)); dc("digits0-2.5", 2.5, list(digits = 0)); dc("digits3", 0.0005, list(digits = 3))
dc("negative-displayed-zero", -0.001, check = ".00"); dc("big", 28091567595.25, list(digits = 1))
add(row("formatDecimal-NaN", "formatDecimal", list(call = list(NaN_)), list(text = "NA")))

# ---- formatSig, formatSci -------------------------------------------------------------------------------------------
sg <- function(id, x, sig = NULL, check = NULL) {
  t <- f_sig(x, if (is.null(sig)) 3 else sig); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatSig-", id), "formatSig", list(call = if (is.null(sig)) list(x) else list(x, list(sig = sig))), list(text = t)))
}
sg("readme-.00165", 0.00165, check = ".00165"); sg("readme-.000203", 0.000203, check = ".000203"); sg("readme-1320", 1318.4, check = "1,320")
sg("tie-1325", 1325, check = "1,320"); sg("tie-1335", 1335, check = "1,340"); sg("carry-.0009996", 0.0009996, check = ".00100")
sg("negative", -0.02274); sg("sig2", 0.12345, sig = 2); sg("sig5", 1318.4, sig = 5, check = "1,318.4"); sg("sig1", 0.0475, sig = 1)
sg("large", 28091567595, check = "28,100,000,000"); sg("one", 1, check = "1.00"); sg("9.995", 9.995); sg("99.95", 99.95)
sci <- function(id, x, opts = list(), check = NULL) {
  t <- do.call(f_sci, c(list(x), opts)); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatSci-", id), "formatSci", list(call = if (length(opts)) list(x, opts) else list(x)), list(text = t)))
}
sci("readme-1.39e-17", 1.39e-17, check = paste0("1.39e", MINUS, "17")); sci("readme-trim", 1e-12, list(trim = TRUE), check = paste0("1e", MINUS, "12"))
sci("readme-times", 5e5, list(style = "times", trim = TRUE), check = "5 × 10⁵"); sci("times-sig1", 5e5, list(style = "times", sig = 1))
sci("times-sig3", 123456789, list(style = "times")); sci("times-12", 1.5e12, list(style = "times", trim = TRUE))
sci("sig2", 6.25e-5, list(sig = 2)); sci("negative", -3.14159e-9); sci("trim-1.50", 1.5e-7, list(trim = TRUE), check = paste0("1.5e", MINUS, "7"))
sci("carry", 9.9996e-5, check = paste0("1.00e", MINUS, "4"))

# ---- formatPercent --------------------------------------------------------------------------------------------------
pc_ <- function(id, x, digits = NULL, bounds = NULL, check = NULL) {
  o <- list(); if (!is.null(digits)) o$digits <- digits; if (!is.null(bounds)) o$bounds <- bounds
  t <- f_percent(x, if (is.null(digits)) 0 else digits, if (is.null(bounds)) TRUE else bounds)
  if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatPercent-", id), "formatPercent", list(call = if (length(o)) list(x, o) else list(x)), list(text = t)))
}
pc_("readme-14", 0.14, check = "14%"); pc_("readme-5.2", 0.052, digits = 1, bounds = FALSE, check = "5.2%")
pc_("readme-0.02", 0.0002, digits = 2, bounds = FALSE, check = "0.02%"); pc_("readme-below", 0.004, check = "below 1%")
pc_("above", 0.996, check = "above 99%"); pc_("zero", 0, check = "0%"); pc_("one", 1, check = "100%")
pc_("exact-share-.015", 0.015, check = "1%")                  # 0.015 is stored below 0.015: 1.4999...%, not 1.5%
pc_("exact-share-.025", 0.025, check = "3%"); pc_(".145", 0.145); pc_(".5", 0.5, check = "50%"); pc_(".005", 0.005)
pc_("digits1-.1234", 0.1234, digits = 1, bounds = FALSE); pc_("digits2-.0675", 0.0675, digits = 2, bounds = FALSE)
pc_("nobounds-.004", 0.004, bounds = FALSE, check = "0%")

# ---- formatCount, formatFraction, rationalApprox, formatRational ----------------------------------------------------
ct <- function(id, n, check = NULL) { t <- f_count(n); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatCount-", id), "formatCount", list(call = list(n)), list(text = t))) }
ct("readme-4683", 4683, check = "4,683"); ct("readme-big", 28091567595, check = "28,091,567,595"); ct("zero", 0, check = "0")
ct("999", 999); ct("1000", 1000); ct("negative", -1234, check = paste0(MINUS, "1,234")); ct("2^53-1", SUM(9007199254740990, 1), check = "9,007,199,254,740,991")
ct("bigint-19digits", BIG("2423922485405222688"), check = "2,423,922,485,405,222,688")
ct("bigint-small", BIG("603"), check = "603")
add(row("formatCount-non-integer-throws", "formatCountThrows", list(call = list(1.5)), list(threw = TRUE)))
fr <- function(id, num, den, check = NULL) { t <- f_fraction(num, den); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatFraction-", id), "formatFraction", list(call = list(num, den)), list(text = t))) }
fr("readme-11/60", 11, 60, check = "11/60"); fr("readme-negative", -1, 2, check = paste0(MINUS, "1/2")); fr("readme-2", 4, 2, check = "2")
fr("readme-den0", 1, 0, check = "NA"); fr("negative-den", 1, -2); fr("both-negative", -3, -9, check = "1/3"); fr("zero", 0, 5, check = "0")
fr("reduce", 120, 360, check = "1/3"); fr("7/40", 7, 40)
ra <- function(id, x, opts = list()) {
  r <- do.call(o_rational, c(list(val(x)), opts))
  add(row(paste0("rationalApprox-", id), "rationalApprox", list(call = if (length(opts)) list(x, opts) else list(x)), list(value = r)))
  invisible(r)
}
stopifnot(identical(ra("readme-11/60", 11/60), list(num = 11, den = 60)))
ra("7/40", 7/40); ra("3/10", 3/10); ra("0.1+0.2", SUM(0.1, 0.2)); ra("-1/2", -1/2); ra("2", 2); ra("0", 0); ra("1/3", 1/3)
ra("999/1000", 999/1000); ra("1/1001-null", 1/1001); ra("pi-null", pi); ra("sqrt2-null", sqrt(2)); ra("1/7-plus-1e-10-null", 1/7 + 1e-10)
ra("1/1001-maxDen2000", 1/1001, list(maxDenominator = 2000)); ra("1/7-plus-1e-10-tol1e-9", 1/7 + 1e-10, list(tolerance = 1e-9))
ra("11/60-maxDen50-null", 11/60, list(maxDenominator = 50)); ra("-7/12", -7/12)
rt <- function(id, x, check = NULL) { r <- o_rational(val(x)); t <- f_fraction(r$num, r$den); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatRational-", id), "formatRational", list(call = list(x)), list(text = t))) }
rt("readme-11/60", 11/60, check = "11/60"); rt("readme-7/40", 7/40, check = "7/40"); rt("readme-3/10", SUM(0.1, 0.2), check = "3/10")
rt("-2/3", -2/3, check = paste0(MINUS, "2/3")); rt("integer-3", 3, check = "3")
add(row("formatRational-pi-throws", "formatRationalThrows", list(call = list(pi)), list(threw = TRUE)))

# ---- formatRatio, formatEoverN, formatSigned ------------------------------------------------------------------------
rr <- function(id, num, den, opts = list(), check = NULL) {
  t <- do.call(f_ratio, c(list(num, den), opts)); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatRatio-", id), "formatRatio", list(call = if (length(opts)) list(num, den, opts) else list(num, den)), list(text = t)))
}
rr("readme-.800", 4, 5, check = ".800"); rr("den0", 1, 0, check = "NA"); rr("digits4", 1, 3, list(digits = 4), check = ".3333")
rr("sig3", 1, 3000, list(sig = 3), check = ".000333"); rr("below", 1, 3000, check = "below .001"); rr("zero", 0, 7, check = "0")
rr("one", 7, 7, check = "1"); rr("11/60", 11, 60)
en <- function(id, E, N, opts = list(), check = NULL) {
  t <- do.call(f_eovern, c(list(E, N), opts)); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatEoverN-", id), "formatEoverN", list(call = if (length(opts)) list(E, N, opts) else list(E, N)), list(text = t)))
}
en("readme-.0255", 0.306, 12, list(digits = 4), check = ".0255"); en("N0", 0, 0, check = "NA: no disclosure")
en("N0-digits4", 0, 0, list(digits = 4), check = "NA: no disclosure"); en("six-112233", 0.0247694, 12, list(digits = 5))
en("default-digits", 0.0247694, 12); en("below", 0.0001, 12); en("E0", 0, 12, check = "0")
# One engine value (null = N = 0, as evaluateReport().EoverN) or an array of them (an array of strings).
env <- function(id, v, opts = list(), check = NULL) {
  one <- function(x) if (is.null(x) || (length(x) == 1 && is.na(x))) "NA: no disclosure" else do.call(f_prob, c(list(x), opts))
  t <- if (is.list(v)) lapply(v, one) else one(v); if (!is.null(check)) stopifnot(identical(unlist(t), check))
  add(row(paste0("formatEoverN-", id), "formatEoverN", list(call = if (length(opts)) list(v, opts) else list(v)), list(text = if (is.list(t)) vec(unlist(t)) else t)))
}
env("value-null", NULL, check = "NA: no disclosure"); env("value-.0255-digits4", 0.0255, list(digits = 4), check = ".0255")
env("value-default", 0.00206411); env("array-digits4", list(0.1, NULL, 0.0255), list(digits = 4), check = c(".1000", "NA: no disclosure", ".0255"))
si <- function(id, x, opts = list(), check = NULL) {
  t <- do.call(f_signed, c(list(x), opts)); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatSigned-", id), "formatSigned", list(call = if (length(opts)) list(x, opts) else list(x)), list(text = t)))
}
si("readme-+.049", 0.049, check = "+.049"); si("readme-negative", -0.0227, list(digits = 4), check = paste0(MINUS, ".0227"))
si("readme-displayed-zero", 0.0001, check = ".000"); si("negative-displayed-zero", -0.0004, check = ".000")
si("sig3", -0.02274, list(sig = 3), check = paste0(MINUS, ".0227")); si("sig3-positive", 0.000203, list(sig = 3), check = "+.000203")
si("exact-zero", 0, check = "0"); si("large", 1234.5678, list(digits = 1), check = "+1,234.6")

# ---- formatSetting, formatGrades, formatSizes, formatTuple ----------------------------------------------------------
st <- function(id, v, check = NULL) {
  t <- f_setting(val(v)); if (!is.null(check)) stopifnot(identical(t, check))
  add(row(paste0("formatSetting-", id), "formatSetting", list(call = list(if (length(v) > 1) vec(v) else v)), list(text = t)))
}
st("readme-.20", 0.2, check = ".20"); st("readme-.25", 0.25, check = ".25"); st("readme-.125", 0.125, check = ".125")
st("readme-1.96", 1.96, check = "1.96"); st("readme-1/3", 1/3, check = "1/3"); st("readme-3", 3, check = "3")
st("readme-w-halves", c(0.5, 0.5), check = "(1/2, 1/2)"); st("readme-w-quarters", c(0.5, 0.25, 0.25), check = "(1/2, 1/4, 1/4)")
st("readme-w-.8.2", c(0.8, 0.2), check = "(.8, .2)"); st("w-thirds", c(1/3, 2/3), check = "(1/3, 2/3)"); st("w-1-0", c(1, 0), check = "(1, 0)")
st("w-.35.65", c(0.35, 0.65), check = "(.35, .65)"); st("w-3/8-5/8", c(3/8, 5/8), check = "(3/8, 5/8)"); st("w-.6.4", c(0.6, 0.4), check = "(.6, .4)")
st("seed", 20261030, check = "20261030"); st("tau-.05", 0.05, check = ".05"); st("tau-.5", 0.5, check = ".50")
st("0.1+0.2", SUM(0.1, 0.2), check = ".30"); st("1/7", 1/7, check = "1/7"); st("2/3", 2/3, check = "2/3"); st("5/12", 5/12, check = "5/12")
st("pi/10", pi / 10, check = ".3142"); st("1/13", 1/13, check = ".0769"); st("level-.95", 0.95, check = ".95"); st("2.5", 2.5, check = "2.50")
gr <- function(id, g) add(row(paste0("formatGrades-", id), "formatGrades", list(call = list(vec(g))), list(text = paste(g, collapse = "/"))))
gr("readme", c(1, 1, 2, 2, 3, 3)); gr("strict", 1:6); gr("one-unit", 1); gr("eleven", c(1, 2, 10, 11, 3))
sz <- function(id, s, label = NULL) {
  t <- paste0(if (isFALSE(label)) "" else "sizes ", paste(s, collapse = ", "))
  add(row(paste0("formatSizes-", id), "formatSizes", list(call = if (is.null(label)) list(vec(s)) else list(vec(s), list(label = label))), list(text = t)))
}
sz("readme", c(3, 6, 3)); sz("nolabel", c(3, 6, 3), FALSE); sz("one", 12); sz("label-true", c(1, 2), TRUE)
tp <- function(id, v, fname = NULL) {
  f <- switch(if (is.null(fname)) "formatProb" else fname, formatProb = f_prob, formatSetting = f_setting, formatRisk = f_risk,
              formatPercent = f_percent)
  t <- paste0("(", paste(vapply(v, f, ""), collapse = ", "), ")")
  add(row(paste0("formatTuple-", id), "formatTuple", list(call = if (is.null(fname)) list(vec(v)) else list(vec(v), FN(fname))), list(text = t)))
  invisible(t)
}
stopifnot(identical(tp("readme", c(0.15, 0.85, 0.2), "formatSetting"), "(.15, .85, .20)"))
tp("default-prob", c(0.188, 0.812)); tp("risk", c(0.0417, 0.0248), "formatRisk"); tp("percent", c(0.14, 0.5), "formatPercent")
tp("prob-bounds", c(0, 0.0004, 1))

# ---- erfc (mpmath, 50 digits) -----------------------------------------------------------------------------------------
xs <- c(-6, -3, -1.5, -1, -0.5, -1e-8, 0, 1e-10, 1e-3, 0.1, 0.25, 0.4769362762044699, 0.5, 0.75, 0.84375, 1, 1.25, 2, 2.5,
        3, 4, 4.5, 5, 6, 8, 10, 12, 15, 20, 25, 26, 26.5, 26.54, 26.6, 27, 30)
py <- tempfile(fileext = ".py")
writeLines(c("import json, sys", "import mpmath", "mpmath.mp.dps = 50",
             "xs = [float(s) for s in sys.argv[1].split(',')]",
             "print(json.dumps({'version': mpmath.__version__, 'values': [repr(float(mpmath.erfc(mpmath.mpf(x)))) for x in xs]}))"), py)
out <- tryCatch(suppressWarnings(system2("python3", c("-I", py, paste(sprintf("%.17g", xs), collapse = ",")), stdout = TRUE, stderr = FALSE)),
                error = function(e) character())
unlink(py)
mp <- if (length(out) == 1L && startsWith(out, "{")) jsonlite::fromJSON(out) else NULL
if (!is.null(mp)) {
  ref <- paste("mpmath", mp$version, "at 50 digits"); vals <- as.numeric(mp$values); use <- rep(TRUE, length(xs))
} else {
  ref <- "2 * pnorm(-sqrt(2) * x) (mpmath unavailable; |x| <= 5 only)"; vals <- 2 * pnorm(-sqrt(2) * xs); use <- abs(xs) <= 5
}
check_ref <- 2 * pnorm(-sqrt(2) * xs)
stopifnot(all(abs(vals[abs(xs) <= 3] - check_ref[abs(xs) <= 3]) <= 1e-13 * check_ref[abs(xs) <= 3]))   # the two references agree
for (i in which(use)) add(row(sprintf("erfc-%.17g", xs[i]), "erfc", list(call = list(xs[i]), reference = ref), list(erfc = vals[i])))

assert_no_postrank()
write_golden("oracle-format", rows, generator = "r-export/11_format.R", uses_postrank = FALSE)
cat("oracle-format:", length(rows), "rows; erfc reference:", ref, "\n")
