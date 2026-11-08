# Author: JoonHo Lee (jlee296@ua.edu).
# The pr-core seeded stream (engine/README.md, "Random stream") in base R, for oracle code and released draws.
# Unsigned 32-bit arithmetic is emulated on doubles; integers and uniforms match the engine bit for bit,
# normals to within a few ulps (different libm), so parity compares normals with relative tolerance 1e-15.

.TWO32 <- 4294967296
.TWO16 <- 65536
.split16 <- function(a) c(a %/% .TWO16, a %% .TWO16)
.xor32 <- function(a, b) { x <- .split16(a); y <- .split16(b); bitwXor(x[1], y[1]) * .TWO16 + bitwXor(x[2], y[2]) }
.or32 <- function(a, b) { x <- .split16(a); y <- .split16(b); bitwOr(x[1], y[1]) * .TWO16 + bitwOr(x[2], y[2]) }
.shr32 <- function(a, k) a %/% 2^k
.add32 <- function(a, b) (a + b) %% .TWO32
.imul32 <- function(a, b) {
  x <- .split16(a); y <- .split16(b)
  (x[2] * y[2] + ((x[1] * y[2] + x[2] * y[1]) %% .TWO16) * .TWO16) %% .TWO32
}

prx_uint32 <- function(seed, count) {
  s <- seed %% .TWO32
  out <- numeric(count)
  for (i in seq_len(count)) {
    s <- .add32(s, 1831565813)
    t <- s
    t <- .imul32(.xor32(t, .shr32(t, 15)), .or32(t, 1))
    t <- .xor32(t, .add32(t, .imul32(.xor32(t, .shr32(t, 7)), .or32(t, 61))))
    out[i] <- .xor32(t, .shr32(t, 14))
  }
  out
}

prx_uniforms <- function(seed, count) (prx_uint32(seed, count) + 0.5) / .TWO32

prx_normals <- function(seed, count) {
  pairs <- ceiling(count / 2)
  u <- prx_uniforms(seed, 2 * pairs)
  z <- numeric(2 * pairs)
  for (k in seq_len(pairs)) {
    r <- sqrt(-2 * log(u[2 * k - 1]))
    t <- (2 * pi) * u[2 * k]
    z[2 * k - 1] <- r * cos(t)
    z[2 * k] <- r * sin(t)
  }
  z[seq_len(count)]
}
