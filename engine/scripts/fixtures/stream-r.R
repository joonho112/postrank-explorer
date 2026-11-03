# Author: JoonHo Lee (jlee296@ua.edu)
# Writes engine/tests/fixtures/stream-r.json: the seeded stream of pr-core (engine/src/random.ts)
# reimplemented in base R from the algorithm stated in engine/README.md ("Random stream"), with unsigned
# 32-bit arithmetic emulated on doubles. engine/tests/random.test.ts checks that the TypeScript stream
# gives the same integers and uniforms bit for bit, and the same normals to within a few ulps.
# Run from engine/:  Rscript scripts/fixtures/stream-r.R   (base R only)

args <- commandArgs(trailingOnly = FALSE)
self <- normalizePath(sub("^--file=", "", args[grep("^--file=", args)]))
out <- file.path(dirname(dirname(dirname(self))), "tests", "fixtures", "stream-r.json")

TWO32 <- 4294967296
TWO16 <- 65536
# unsigned 32-bit helpers on doubles in [0, 2^32); bitw* work on 16-bit halves (R integers are signed 32-bit)
split16 <- function(a) c(a %/% TWO16, a %% TWO16)
xor32 <- function(a, b) { x <- split16(a); y <- split16(b); bitwXor(x[1], y[1]) * TWO16 + bitwXor(x[2], y[2]) }
or32 <- function(a, b) { x <- split16(a); y <- split16(b); bitwOr(x[1], y[1]) * TWO16 + bitwOr(x[2], y[2]) }
shr32 <- function(a, k) a %/% 2^k
add32 <- function(a, b) (a + b) %% TWO32
imul32 <- function(a, b) {
  x <- split16(a); y <- split16(b)
  (x[2] * y[2] + ((x[1] * y[2] + x[2] * y[1]) %% TWO16) * TWO16) %% TWO32
}

mulberry32 <- function(seed, count) {
  s <- seed %% TWO32
  out <- numeric(count)
  for (i in seq_len(count)) {
    s <- add32(s, 1831565813) # 0x6D2B79F5
    t <- s
    t <- imul32(xor32(t, shr32(t, 15)), or32(t, 1))
    t <- xor32(t, add32(t, imul32(xor32(t, shr32(t, 7)), or32(t, 61))))
    out[i] <- xor32(t, shr32(t, 14))
  }
  out
}
uniforms <- function(seed, count) (mulberry32(seed, count) + 0.5) / TWO32
normals <- function(seed, count) {
  pairs <- ceiling(count / 2)
  u <- uniforms(seed, 2 * pairs)
  z <- numeric(2 * pairs)
  for (k in seq_len(pairs)) {
    u1 <- u[2 * k - 1]
    u2 <- u[2 * k]
    r <- sqrt(-2 * log(u1))
    t <- (2 * pi) * u2
    z[2 * k - 1] <- r * cos(t)
    z[2 * k] <- r * sin(t)
  }
  z[seq_len(count)]
}

num <- function(x) paste0("[", paste(sprintf("%.17g", x), collapse = ","), "]")
int <- function(x) paste0("[", paste(sprintf("%.0f", x), collapse = ","), "]")
jstr <- function(x) {
  x <- gsub("\\\\", "\\\\\\\\", x)
  x <- gsub("\"", "\\\\\"", x)
  x <- gsub("\t", "\\\\t", x)
  x <- gsub("\n", "\\\\n", x)
  paste0("\"", x, "\"")
}

# seeds: zero, small, the extremes of the 32-bit range, a negative seed (wraps to 2^32 - 1), and a long run
cases <- list(
  list(seed = 0, count = 16), list(seed = 1, count = 16), list(seed = 42, count = 16),
  list(seed = 2147483648, count = 16), list(seed = 4294967295, count = 16), list(seed = -1, count = 16),
  list(seed = 123456789, count = 16), list(seed = 20261031, count = 1000)
)
rows <- vapply(cases, function(cs) {
  paste0(
    "{\"seed\": ", sprintf("%.0f", cs$seed),
    ", \"uint32\": ", int(mulberry32(cs$seed, cs$count)),
    ", \"uniform\": ", num(uniforms(cs$seed, cs$count)),
    ", \"normal\": ", num(normals(cs$seed, cs$count)), "}"
  )
}, character(1))

code <- paste(readLines(self, warn = FALSE), collapse = "\n")
json <- paste0(
  "{\n",
  "\"description\": ", jstr("pr-core seeded stream (mulberry32 integers, open uniforms, Box-Muller normals) reimplemented in base R from engine/README.md."), ",\n",
  "\"r_version\": ", jstr(R.version.string), ",\n",
  "\"platform\": ", jstr(R.version$platform), ",\n",
  "\"generator\": ", jstr("engine/scripts/fixtures/stream-r.R"), ",\n",
  "\"code\": ", jstr(code), ",\n",
  "\"cases\": [\n", paste(rows, collapse = ",\n"), "\n]\n",
  "}\n"
)
writeLines(json, out, sep = "")
cat(sprintf("wrote %s: %d seeds\n", out, length(cases)))
