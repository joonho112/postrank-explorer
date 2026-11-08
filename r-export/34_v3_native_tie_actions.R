# Author: JoonHo Lee (jlee296@ua.edu).
# Independent finite-law oracle for app 3.13's native actions on reporting ties.
# Contract source: engine/API.md only. No app/TypeScript implementation, JS,
# postrank package or optimizer is read/run. Enumerate all 13 reports in base R.
# Run from repository root: Rscript r-export/34_v3_native_tie_actions.R
source('r-export/_paths.R')
source('r-export/_helpers.R')
stopifnot(!('postrank' %in% loadedNamespaces()))
vec <- function(x) I(unname(x))

states <- rbind(c(20, 4, 3), c(0, 4, 3))
probs <- c(.3, .7)
tau <- .30
tieTol <- 1e-12
budget <- 1L
threshold <- 3.5
falsePositiveCost <- 1
falseNegativeCost <- 1
positiveGrade <- 2L
n <- ncol(states)
M <- choose(n, 2)
stopifnot(sum(probs) == 1, all(apply(states, 1L, function(x)
  length(unique(x)) == n)))
means <- colSums(states * probs)
top <- matrix(FALSE, nrow(states), n)
for (s in seq_len(nrow(states))) top[s, order(-states[s, ])[seq_len(budget)]] <- TRUE
pTop <- colSums(top * probs)
event <- states > threshold
probabilities <- colSums(event * probs)
stopifnot(max(abs(means - c(6, 4, 3))) < 1e-14,
  max(abs(pTop - c(.3, .7, 0))) < 1e-14,
  max(abs(probabilities - c(.3, 1, 0))) < 1e-14)

e <- matrix(NA_real_, n, n)
for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
  e[i, j] <- sum(probs * (states[, i] <= states[, j]))

all_grades <- as.matrix(expand.grid(rep(list(seq_len(n)), n)))
canonical <- apply(all_grades, 1L, function(g)
  identical(sort(unique(as.integer(g))), seq_len(max(g))))
all_grades <- all_grades[canonical, , drop = FALSE]
all_grades <- all_grades[do.call(order, unname(as.data.frame(all_grades))), , drop = FALSE]
stopifnot(nrow(all_grades) == 13L)

report_evaluation <- function(g) {
  stated <- outer(g, g, '<')
  N <- sum(stated)
  Ew <- sum(e[stated])
  wrong <- integer(nrow(states))
  for (i in seq_len(n - 1L)) for (j in seq.int(i + 1L, n)) if (g[i] != g[j]) {
    a <- if (g[i] < g[j]) i else j
    b <- if (g[i] < g[j]) j else i
    wrong <- wrong + as.integer(states[, a] <= states[, b])
  }
  risk <- (Ew + tau * (M - N)) / M
  stopifnot(abs(Ew - sum(probs * wrong)) < 1e-14,
    abs(risk - sum(probs * (wrong + tau * (M - N)) / M)) < 1e-14)
  list(grade = vec(g), N = N, Ew = Ew, risk = risk)
}

# Enumerate the complete boundary subsets, then average their inclusion, value
# and statewise top overlap. The lottery is independent of the latent state.
allocate <- function(g) {
  occupied <- sort(unique(g))
  cumulative <- cumsum(vapply(occupied, function(h) sum(g == h), 0L))
  boundaryGrade <- occupied[which(cumulative >= budget)[1L]]
  above <- which(g < boundaryGrade)
  boundary <- which(g == boundaryGrade)
  remaining <- budget - length(above)
  # combn(x, ...) treats a singleton numeric x as 1:x. Enumerate positions,
  # then map back to members so a boundary containing only unit B stays {B}.
  subsets <- if (remaining == 0L) list(integer()) else
    lapply(combn(seq_along(boundary), remaining, simplify = FALSE), function(j) boundary[j])
  selections <- lapply(subsets, function(s) c(above, s))
  membership <- t(vapply(selections, function(s) seq_len(n) %in% s, logical(n)))
  inclusion <- colMeans(membership)
  expectedValue <- mean(vapply(selections, function(s) sum(means[s]), 0))
  expectedOverlap <- mean(vapply(selections, function(selected)
    sum(probs * rowSums(top[, selected, drop = FALSE])), 0))
  stopifnot(all(rowSums(membership) == budget),
    abs(expectedValue - sum(inclusion * means)) < 1e-14,
    abs(expectedOverlap - sum(inclusion * pTop)) < 1e-14)
  list(inclusion = vec(inclusion), expectedValue = expectedValue,
    expectedOverlap = expectedOverlap, overlapShare = expectedOverlap / budget,
    selectedCount = sum(inclusion), budget = budget, boundaryGrade = boundaryGrade,
    boundaryMembers = vec(boundary - 1L), boundarySize = length(boundary),
    remaining = remaining, aboveCount = length(above))
}

classify_positive <- function(positive, values = means) {
  cutoff <- falsePositiveCost / (falsePositiveCost + falseNegativeCost)
  positiveCost <- falsePositiveCost * (1 - probabilities)
  negativeCost <- falseNegativeCost * probabilities
  expectedFalsePositives <- sum((1 - probabilities)[positive])
  expectedFalseNegatives <- sum(probabilities[!positive])
  totalCost <- sum(positiveCost[positive]) + sum(negativeCost[!positive])
  stateCost <- vapply(seq_len(nrow(states)), function(s)
    falsePositiveCost * sum(positive & !event[s, ]) +
    falseNegativeCost * sum(!positive & event[s, ]), 0)
  stopifnot(abs(totalCost - sum(probs * stateCost)) < 1e-14)
  # This value uses exactly the explicit binary classification action. No
  # budget or report-to-allocation lottery enters the selected-value axis.
  selectedValue <- if (is.null(values)) NULL else sum(values[positive])
  if (!is.null(values)) {
    stopifnot(length(values) == n, all(is.finite(values)))
    stateSelectedValue <- rowSums(states[, positive, drop = FALSE])
    stopifnot(abs(selectedValue - sum(probs * stateSelectedValue)) < 1e-14)
  }
  list(positive = vec(positive), bayesPositive = vec(probabilities >= cutoff),
    positiveCount = sum(positive), cutoff = cutoff,
    positiveCost = vec(positiveCost), negativeCost = vec(negativeCost),
    expectedFalsePositives = expectedFalsePositives,
    expectedFalseNegatives = expectedFalseNegatives,
    totalCost = totalCost, meanCost = totalCost / n, selectedValue = selectedValue)
}
classify <- function(g) classify_positive(g <= positiveGrade)

allReports <- lapply(seq_len(nrow(all_grades)), function(i)
  report_evaluation(as.integer(all_grades[i, ])))
risks <- vapply(allReports, `[[`, 0, 'risk')
members <- which(abs(risks - min(risks)) <= tieTol)
optimal <- all_grades[members, , drop = FALSE]
stopifnot(nrow(optimal) == 2L,
  identical(as.integer(optimal[1L, ]), c(2L, 1L, 2L)),
  identical(as.integer(optimal[2L, ]), c(3L, 1L, 2L)))
reports <- lapply(members, function(i) c(allReports[[i]],
  list(allocation = allocate(all_grades[i, ]), classification = classify(all_grades[i, ]))))
stopifnot(reports[[1L]]$N == 2L, reports[[2L]]$N == 3L,
  abs(reports[[1L]]$Ew - .3) < 1e-14, abs(reports[[2L]]$Ew - .6) < 1e-14,
  all(abs(vapply(reports, `[[`, 0, 'risk') - .2) < 1e-14),
  identical(reports[[1L]]$allocation, reports[[2L]]$allocation),
  identical(as.numeric(reports[[1L]]$allocation$inclusion), c(0, 1, 0)),
  abs(reports[[1L]]$allocation$expectedValue - 4) < 1e-14,
  abs(reports[[1L]]$allocation$expectedOverlap - .7) < 1e-14,
  reports[[1L]]$classification$positiveCount == 3L,
  reports[[2L]]$classification$positiveCount == 2L,
  abs(reports[[1L]]$classification$totalCost - 1.7) < 1e-14,
  abs(reports[[2L]]$classification$totalCost - 1.3) < 1e-14,
  abs(reports[[1L]]$classification$selectedValue - 13) < 1e-14,
  abs(reports[[2L]]$classification$selectedValue - 7) < 1e-14)
bayesClassification <- classify_positive(probabilities >=
  falsePositiveCost / (falsePositiveCost + falseNegativeCost))
stopifnot(identical(as.logical(bayesClassification$positive), c(FALSE, TRUE, FALSE)),
  abs(bayesClassification$selectedValue - 4) < 1e-14,
  is.null(classify_positive(c(FALSE, TRUE, FALSE), values = NULL)$selectedValue))

answer <- list(means = vec(means), pTop = vec(pTop), probabilities = vec(probabilities),
  grades = lapply(members, function(i) vec(all_grades[i, ])),
  tieCount = length(members), tieTol = tieTol, allReports = allReports, reports = reports,
  bayesClassification = bayesClassification)
args <- list(fn = 'nativeTieActions', states = unname(states), probs = vec(probs),
  tau = tau, tieTol = tieTol, budget = budget, threshold = threshold,
  falsePositiveCost = falsePositiveCost, falseNegativeCost = falseNegativeCost,
  positiveGrade = positiveGrade)
record <- list(candidateCount = nrow(all_grades),
  membership = 'All reports within absolute risk tolerance 1e-12 of the enumerated minimum',
  ordering = 'Lexicographic canonical grade vectors',
  allocationConvention = 'Higher grades first; uniform complete subset of the boundary grade; budget exactly 1',
  classificationConvention = 'Positive iff grade <= 2; target event is strictly theta > 3.5',
  contrast = '212 and 312 both allocate the one place to B (expected value 4, overlap .7). At h=2, 212 declares all 3 positive with total cost 1.7 and selected value 13; 312 declares B and C positive with total cost 1.3 and selected value 7. The Bayes classification declares only B positive with selected value 4.',
  minimumRisk = min(risks), nextExcludedRiskGap = min(risks[-members]) - min(risks))
rows <- list(list(id = 'tb19-tau30-native-actions-h2-budget1',
  args = args, expect = answer, record = record))
stopifnot(!('postrank' %in% loadedNamespaces()))
write_golden('oracle-v3-native-tie-actions', rows,
  'r-export/34_v3_native_tie_actions.R', uses_postrank = FALSE)
cat(jsonlite::toJSON(list(group = 'oracle-v3-native-tie-actions',
  candidateCount = nrow(all_grades), expected = answer,
  nextExcludedRiskGap = record$nextExcludedRiskGap),
  auto_unbox = TRUE, digits = NA, pretty = TRUE), '\n')
