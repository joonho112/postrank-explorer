# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R tie audit for app 3.8's frozen league ordered cuts.
# Contract read only from engine/API.md: absolute risk-scale tieTol, equal-score
# blocks remain intact, representative uses fewer grades then earlier cuts.
# No app, TypeScript implementation, package optimizer or JavaScript is read/run.
# Run from repository root: Rscript r-export/33_v3_ordered_tau_ties.R
source('r-export/_paths.R')
source('r-export/_helpers.R')
source('r-export/_rng.R')
stopifnot(!('postrank' %in% loadedNamespaces()))

vec <- function(x) I(unname(x))
seed <- 20261030
n <- 30L
G <- 3L
tau <- .05300042422140842
tieTol <- 1e-12
priorMean <- 0
priorSd <- .15
M <- choose(n, 2)

# The public frozen input's facts specify this league and random stream. Rebuild
# it in base R, then check its inputs against that supplied snapshot.
frozen <- jsonlite::fromJSON(file.path(prx_root, 'data', 'precomputed', 'league-30.json'),
  simplifyVector = FALSE)
ids <- unlist(frozen$tables$units$id, use.names = FALSE)
size <- rep(c(16, 64, 256), length.out = n)
se <- .8 / sqrt(size)
rank <- (19 * seq_len(n)) %% 31
theta <- .15 * qnorm((rank - .5) / n)
estimate <- theta + se * prx_normals(seed, n)
stopifnot(frozen$facts$seed == seed, length(ids) == n,
  identical(ids, sprintf('U%02d', seq_len(n))),
  max(abs(estimate - unlist(frozen$tables$units$estimate, use.names = FALSE))) < 1e-14,
  max(abs(theta - unlist(frozen$tables$units$theta, use.names = FALSE))) < 1e-14,
  identical(se, unlist(frozen$tables$units$se, use.names = FALSE)))

shrink <- priorSd^2 / (priorSd^2 + se^2)
means <- priorMean + shrink * (estimate - priorMean)
sds <- sqrt(shrink) * se
order_index <- order(-means, seq_len(n))
ordered_means <- means[order_index]
blocks <- cumsum(c(TRUE, diff(ordered_means) != 0))
# Permitted cuts are the ends of complete equal-score blocks only.
permitted <- which(diff(blocks) != 0L)
stopifnot(length(permitted) == n - 1L)
e <- outer(seq_len(n), seq_len(n), function(i, j)
  pnorm((means[j] - means[i]) / sqrt(sds[i]^2 + sds[j]^2)))
diag(e) <- NA_real_

cut_sets <- list(integer())
for (k in seq_len(G - 1L)) cut_sets <- c(cut_sets,
  combn(permitted, k, simplify = FALSE))
stopifnot(length(cut_sets) == sum(vapply(0:(G - 1L), function(k)
  choose(length(permitted), k), 0)), length(cut_sets) == 436L)

# Evaluate each canonical grade vector by a direct sum over stated unit pairs.
# Independently recompute E/N with a loop over ordered-position block pairs.
candidates <- lapply(cut_sets, function(cuts) {
  ordered_grade <- 1L + findInterval(seq_len(n) - 1L, cuts)
  grade <- integer(n)
  grade[order_index] <- ordered_grade
  stated <- outer(grade, grade, '<')
  N <- sum(stated)
  Ew <- sum(e[stated])
  other_N <- 0L
  other_E <- 0
  for (p in seq_len(n - 1L)) for (q in seq.int(p + 1L, n)) {
    if (ordered_grade[p] != ordered_grade[q]) {
      other_N <- other_N + 1L
      other_E <- other_E + e[order_index[p], order_index[q]]
    }
  }
  sizes <- tabulate(grade)
  stopifnot(N == other_N, N == M - sum(sizes * (sizes - 1L) / 2),
    abs(Ew - other_E) < 1e-11,
    all(vapply(split(ordered_grade, blocks), function(x) length(unique(x)) == 1L, TRUE)))
  list(grade = grade, cuts = cuts, G = length(cuts) + 1L,
    N = N, Ew = Ew, risk = (Ew + tau * (M - N)) / M)
})
risks <- vapply(candidates, `[[`, 0, 'risk')
minimum <- min(risks)
members <- which(abs(risks - minimum) <= tieTol)
stopifnot(length(members) >= 2L)

# Enumerated cuts are grouped by fewer grades; combn columns are lexicographic
# earlier cuts within a grade count. Choose the first admitted representative.
representative <- members[1L]
member_grades <- do.call(rbind, lapply(candidates[members], `[[`, 'grade'))
lex_order <- do.call(order, unname(as.data.frame(member_grades)))
member_indices <- members[lex_order]
complete_grades <- lapply(candidates[member_indices], function(x) vec(x$grade))
reports <- lapply(candidates[member_indices], function(x)
  list(grade = vec(x$grade), N = x$N, Ew = x$Ew, risk = x$risk))
answer <- list(grade = vec(candidates[[representative]]$grade),
  grades = complete_grades, tieCount = length(members), tieTol = tieTol,
  order = vec(order_index - 1L), reports = reports)

audit <- lapply(seq_along(candidates), function(i) {
  x <- candidates[[i]]
  list(cuts = vec(x$cuts), G = x$G, N = x$N, Ew = x$Ew,
    risk = x$risk, excessOverMinimum = x$risk - minimum,
    admittedByTieTolerance = i %in% members)
})
record <- list(candidateCount = length(candidates),
  suppliedLaw = 'Independent normal-normal posteriors, prior mean 0 and SD .15',
  scores = 'Posterior means, descending; exact-score blocks kept intact',
  completeListOrdering = 'Lexicographic canonical grade vectors',
  representativePolicy = 'Fewer occupied grades, then lexicographically earlier cuts',
  minimumRisk = minimum,
  nextExcludedRiskGap = min(risks[-members]) - minimum,
  representativeCuts = vec(candidates[[representative]]$cuts),
  candidateAudit = audit)
args <- list(fn = 'orderedTauTies', seed = seed, priorMean = priorMean,
  priorSd = priorSd, n = n, G = G, tau = tau, tieTol = tieTol)
rows <- list(list(id = 'league30-cap3-tau005300042422140842-ties',
  args = args, expect = answer, record = record))
stopifnot(!('postrank' %in% loadedNamespaces()))
write_golden('oracle-v3-ordered-tau-ties', rows,
  'r-export/33_v3_ordered_tau_ties.R', uses_postrank = FALSE)
cat(jsonlite::toJSON(list(group = 'oracle-v3-ordered-tau-ties',
  candidateCount = length(candidates), expected = answer,
  representativeCuts = record$representativeCuts,
  minimumRisk = minimum, nextExcludedRiskGap = record$nextExcludedRiskGap),
  auto_unbox = TRUE, digits = NA, pretty = TRUE), '\n')
