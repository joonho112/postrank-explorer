# Author: JoonHo Lee (jlee296@ua.edu)
# Writes engine/tests/fixtures/normal-r.json: R's pnorm, pnorm(upper), dnorm and qnorm on a grid with
# |z| up to 37 and p down to 1e-300. engine/tests/special.test.ts compares pr-core with these values.
# Run from engine/:  Rscript scripts/fixtures/normal-r.R   (base R only; no packages)
# Numbers are written with sprintf("%.17g"), which identifies each double exactly.

args <- commandArgs(trailingOnly = FALSE)
self <- normalizePath(sub("^--file=", "", args[grep("^--file=", args)]))
out <- file.path(dirname(dirname(dirname(self))), "tests", "fixtures", "normal-r.json")

set.seed(20261031, kind = "Mersenne-Twister", normal.kind = "Inversion", sample.kind = "Rejection")

# z grid: regular, random, and every branch boundary of the algorithms (with neighbours one ulp away)
nb <- function(x) c(x * (1 - 2^-52), x, x * (1 + 2^-52))
z_special <- c(
  0, 1e-300, 1e-20, .Machine$double.eps / 2, .Machine$double.eps, 1e-10, 1e-5, 1e-3,
  nb(0.67448975), nb(sqrt(32)), nb(5), 4.999999, 5.000001, 8.29, nb(8.2924), 10, 20, 30, 36.5, 36.99, 37
)
z <- c(seq(-37, 37, by = 0.05), runif(2000, -37, 37), runif(500, -6, 6), z_special, -z_special)
z <- unique(z[abs(z) <= 37])

# p grid (lower tail): log grid to 1e-300, linear grid, random, near 1, and the branch boundaries
p_special <- c(0.5, 0.5 + 2^-40, 0.5 - 2^-40, nb(0.075), nb(0.925), nb(exp(-25)), 1e-300, 1e-200, 1e-100)
p_low <- 10^seq(-300, log10(0.5), length.out = 1201)
p <- c(p_low, seq(0.0005, 0.9995, by = 0.0005), runif(1000), 10^runif(1000, -300, 0),
       1 - 2^-(1:53), 1 - 10^-(1:15), p_special)
p <- unique(p[p >= 1e-300 & p < 1])

# p grid (upper tail): small upper-tail probabilities taken directly
p_upper <- unique(c(p_low, 10^runif(500, -300, 0), runif(200)))
p_upper <- p_upper[p_upper >= 1e-300 & p_upper < 1]

num <- function(x) paste0("[", paste(sprintf("%.17g", x), collapse = ","), "]")
jstr <- function(x) {
  x <- gsub("\\\\", "\\\\\\\\", x)
  x <- gsub("\"", "\\\\\"", x)
  x <- gsub("\t", "\\\\t", x)
  x <- gsub("\n", "\\\\n", x)
  paste0("\"", x, "\"")
}

code <- paste(readLines(self, warn = FALSE), collapse = "\n")
json <- paste0(
  "{\n",
  "\"description\": ", jstr("R reference values for the standard normal functions of pr-core (engine/src/special.ts)."), ",\n",
  "\"r_version\": ", jstr(R.version.string), ",\n",
  "\"platform\": ", jstr(R.version$platform), ",\n",
  "\"generator\": ", jstr("engine/scripts/fixtures/normal-r.R"), ",\n",
  "\"code\": ", jstr(code), ",\n",
  "\"z\": ", num(z), ",\n",
  "\"pnorm\": ", num(pnorm(z)), ",\n",
  "\"pnorm_upper\": ", num(pnorm(z, lower.tail = FALSE)), ",\n",
  "\"dnorm\": ", num(dnorm(z)), ",\n",
  "\"p\": ", num(p), ",\n",
  "\"qnorm\": ", num(qnorm(p)), ",\n",
  "\"p_upper\": ", num(p_upper), ",\n",
  "\"qnorm_upper\": ", num(qnorm(p_upper, lower.tail = FALSE)), "\n",
  "}\n"
)
writeLines(json, out, sep = "")
cat(sprintf("wrote %s: %d z values, %d lower-tail p, %d upper-tail p\n", out, length(z), length(p), length(p_upper)))
