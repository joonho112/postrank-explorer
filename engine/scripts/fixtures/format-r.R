# Author: JoonHo Lee (jlee296@ua.edu).
# Writes engine/tests/fixtures/format-r.json: R's sprintf("%.<d>f", x) for exact binary ties (k/2^j), near
# ties (2.675, 1.0005, ...), random values and large values, at d = 0 ... 6 decimals. pr-core rounds the exact
# binary value with ties to even, as C printf does, so engine/tests/format.test.ts expects the same digits
# (after the house rules: U+2212 minus, and no sign on a value displayed as zero).
# Run from engine/:  Rscript scripts/fixtures/format-r.R   (base R only)

args <- commandArgs(trailingOnly = FALSE)
self <- normalizePath(sub("^--file=", "", args[grep("^--file=", args)]))
out <- file.path(dirname(dirname(dirname(self))), "tests", "fixtures", "format-r.json")

set.seed(20261031, kind = "Mersenne-Twister", normal.kind = "Inversion", sample.kind = "Rejection")
ties <- c(seq(1 / 128, 4, by = 1 / 128), (1:64) / 2^10, (1:32) / 2^14)
near <- c(0.0005, 1.0005, 0.1235, 2.675, 0.125, 0.375, 1.5, 2.5, 0.5, 0.045, 0.0417, 0.1875, 0.0625, 0.9995, 0.99949999999999994)
rand <- c(runif(400, -2, 2), 10^runif(200, -8, 6), -10^runif(50, -8, 6))
large <- c(1e15 + 0.5, 123456789.125, 4683.5, 28091567595.5, 2^52 + 0.5, 1e18)
x <- unique(c(ties, -ties[seq(1, length(ties), by = 7)], near, -near, rand, large))
x <- x[x != 0]

rows <- character(0)
for (d in 0:6) {
  s <- sprintf(paste0("%.", d, "f"), x)
  rows <- c(rows, sprintf("[%s,%d,\"%s\"]", sprintf("%.17g", x), d, s))
}
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
  "\"description\": ", jstr("R sprintf fixed-decimal strings: [x, digits, sprintf(\"%.<digits>f\", x)]."), ",\n",
  "\"r_version\": ", jstr(R.version.string), ",\n",
  "\"platform\": ", jstr(R.version$platform), ",\n",
  "\"generator\": ", jstr("engine/scripts/fixtures/format-r.R"), ",\n",
  "\"code\": ", jstr(code), ",\n",
  "\"rows\": [\n", paste(rows, collapse = ",\n"), "\n]\n",
  "}\n"
)
writeLines(json, out, sep = "")
cat(sprintf("wrote %s: %d values x 7 digit counts\n", out, length(x)))
