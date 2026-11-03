# Author: JoonHo Lee (jlee296@ua.edu)
# Part 2 UI pins for existing public engine operations.
# Expected values use only base-R arithmetic, pnorm, complete finite laws and full small-family
# enumeration, from the reviewed run-kit specification and the public book. No postrank or JS
# is loaded for generation. The adapter separately exercises the public JavaScript API.
source("r-export/_paths.R")
source("r-export/_helpers.R")
source("r-export/_oracle.R")
source("r-export/_rng.R")
assert_no_postrank()
vec <- function(x) I(unname(x))
rows <- list()
add <- function(id, kind, args, expect) rows[[length(rows) + 1L]] <<-
  list(id = id, args = c(list(kind = kind), args), expect = expect)
cube <- function(m) list(lapply(seq_len(nrow(m)), function(i) vec(m[i, ])))
array_input <- function(m, ids) list(ids = vec(ids), criteria = vec("score"), e = cube(m))
canon <- function(g) match(g, sort(unique(g)))

families <- new.env(parent = emptyenv())
reports <- function(n, family) {
  key <- paste(n, family$kind, family$G %||% n, sep = ":")
  if (exists(key, families, inherits = FALSE)) return(get(key, families))
  cap <- if (family$kind == "all") n else family$G
  g <- oracle_reports(n, cap)
  if (family$kind == "exactly") g <- g[apply(g, 1, max) == family$G, , drop = FALSE]
  g <- g[do.call(order, as.data.frame(g)), , drop = FALSE]
  assign(key, g, families)
  g
}
`%||%` <- function(a, b) if (is.null(a)) b else a
counts <- function(g, e, tau) {
  q <- oracle_report_counts(g, e)
  M <- choose(length(g), 2)
  list(M = M, N = q$N, Ew = q$E, risk = (q$E + tau * (M - q$N)) / M,
       EoverN = if (q$N > 0) q$E / q$N else NULL)
}
optimum <- function(e, tau, family, tie_tol = 1e-12) {
  g <- reports(nrow(e), family)
  risk <- apply(g, 1, oracle_risk, e = e, tau = tau)
  minimum <- min(risk)
  ix <- which(abs(risk - minimum) <= tie_tol)
  chosen <- as.integer(g[ix[1L], ])
  c(list(grade = chosen, tieCount = length(ix), familySize = nrow(g)), counts(chosen, e, tau))
}
normal_e <- function(means, sds) {
  n <- length(means)
  e <- matrix(NA_real_, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
    e[i, j] <- pnorm((means[j] - means[i]) / sqrt(sds[i]^2 + sds[j]^2))
  e
}
finite_coefficients <- function(states, p) {
  n <- ncol(states)
  b <- t <- d <- e <- matrix(NA_real_, n, n)
  for (i in seq_len(n)) for (j in seq_len(n)) if (i != j) {
    b[i, j] <- sum(p[states[, i] < states[, j]])
    t[i, j] <- sum(p[states[, i] == states[, j]])
    d[i, j] <- sum(p[states[, i] != states[, j]])
    e[i, j] <- sum(p[states[, i] <= states[, j]])
  }
  list(b = b, t = t, d = d, e = e)
}

# Pair equality, including exact boundary settings. The certain law changes both strict masses.
pair_cases <- list(
  list(id = "pair-no-equality", t = 0, tau = .25),
  list(id = "pair-weak-boundary", t = .15, tau = .25),
  list(id = "pair-m4", t = .4, tau = .25),
  list(id = "pair-neutral-first-boundary", t = .6, tau = .25),
  list(id = "pair-neutral-second-boundary", t = 13/15, tau = .25),
  list(id = "pair-high-equality", t = .9, tau = .25),
  list(id = "pair-certain-equality", t = 1, tau = .25, certain = TRUE),
  list(id = "pair-neutral-triple-boundary", t = .8, tau = .5)
)
actions <- rbind(c(1, 2), c(2, 1), c(1, 1))
states <- rbind(c(0, 1), c(1, 1), c(2, 1))
for (z in pair_cases) {
  certain <- isTRUE(z$certain)
  p <- if (certain) c(0, 1, 0) else c(.1, z$t, .9 - z$t)
  law <- finite_coefficients(states, p)
  N <- apply(actions, 1, function(g) sum(outer(g, g, "<")))
  strict <- apply(actions, 1, function(g) sum(law$b[outer(g, g, "<")]))
  Q <- apply(actions, 1, function(g) sum(law$d[outer(g, g, "<")]))
  T <- sum(law$d[upper.tri(law$d)])
  weak <- apply(actions, 1, oracle_risk, e = law$e, tau = z$tau)
  neutral <- strict + z$tau * (T - Q)
  # Closed-form crossings of the m4 risk lines, independent of any app geometry routine.
  weak_switch <- z$tau - .1
  neutral_switch <- unique(c(1 - .1 / z$tau, (.9 - z$tau) / (1 - z$tau)))
  weak_switch <- weak_switch[weak_switch >= 0 & weak_switch <= .9]
  neutral_switch <- sort(neutral_switch[neutral_switch >= 0 & neutral_switch <= .9])
  if (length(neutral_switch) == 2 && abs(diff(neutral_switch)) <= 1e-12) neutral_switch <- neutral_switch[1]
  if (certain) weak_switch <- neutral_switch <- numeric()
  add(z$id, "pair-equality", list(t = z$t, tau = z$tau, certain = certain), list(
    weakCosts = vec(weak), neutralCosts = vec(neutral),
    weakBest = vec(which(weak - min(weak) <= 1e-12) - 1L),
    neutralBest = vec(which(neutral - min(neutral) <= 1e-12) - 1L),
    N = vec(N), strict = vec(strict), Q = vec(Q), T = T, R0 = z$tau * T,
    EoverN = vec(ifelse(N > 0, strict / N, NA_real_)),
    EoverQ = vec(ifelse(Q > 0, strict / Q, NA_real_)),
    weakSwitch = vec(weak_switch), neutralSwitch = vec(neutral_switch),
    familySize = 3L, guardAdmissible = vec(if (certain) c(FALSE, FALSE, TRUE) else rep(TRUE, 3))
  ))
}

# Chapter 10 dominance/cap construction: full enumeration of all three domains.
dom_states <- rbind(c(4, 3, 2, 1), c(2, 1, 4, 3))
dom_p <- c(.6, .4)
dom <- finite_coefficients(dom_states, dom_p)
dom_tau <- 4/9
for (f in list(list(kind = "all"), list(kind = "atMost", G = 2L), list(kind = "exactly", G = 2L))) {
  o <- optimum(dom$e, dom_tau, f)
  separating <- counts(c(1, 1, 2, 2), dom$e, dom_tau)
  add(paste0("dominance-", f$kind), "dominance", list(
    states = lapply(seq_len(nrow(dom_states)), function(s) lapply(dom_states[s, ], function(v) vec(v))),
    probs = vec(dom_p), ids = vec(c("A", "B", "X", "Y")), tau = dom_tau, family = f), list(
      grade = vec(o$grade), risk = o$risk, N = o$N, Ew = o$Ew, EoverN = o$EoverN,
      familySize = o$familySize, tieCount = o$tieCount,
      crossProbabilities = vec(as.vector(t(1 - dom$e[1:2, 3:4, drop = FALSE]))), threshold = 1 - dom_tau,
      separatingRisk = separating$risk, separatingN = separating$N, separatingEw = separating$Ew,
      separatingEoverN = separating$EoverN))
}

# Gaussian pins start from the released marginal summaries, never from released pair arrays.
six <- jsonlite::fromJSON(file.path(released_dir, "six-sites.json"))$tables$units
ids <- six$id
means <- six$mean_A
sds <- six$sd_A
base_e <- normal_e(means, sds)

another_cases <- list(
  list(id = "another-law-same", tau = .2, shift = 0, scale = 1, family = list(kind = "atMost", G = 3L)),
  list(id = "another-law-move", tau = .2, shift = 1, scale = 1, family = list(kind = "atMost", G = 3L)),
  list(id = "another-law-spread", tau = .2, shift = 0, scale = 2, family = list(kind = "atMost", G = 3L)),
  list(id = "another-law-uncapped", tau = .2, shift = .4, scale = 1, family = list(kind = "all")),
  list(id = "another-law-small", tau = .36, shift = .01, scale = 1, family = list(kind = "all"))
)
for (z in another_cases) {
  changed <- means
  changed[3] <- changed[3] + z$shift
  eval_e <- normal_e(changed, sds * z$scale)
  selected <- optimum(base_e, z$tau, z$family, 0)
  optimum_eval <- optimum(eval_e, z$tau, z$family, 0)
  r00 <- oracle_risk(selected$grade, base_e, z$tau)
  r01 <- oracle_risk(selected$grade, eval_e, z$tau)
  r10 <- oracle_risk(optimum_eval$grade, base_e, z$tau)
  r11 <- oracle_risk(optimum_eval$grade, eval_e, z$tau)
  delta <- max(abs(base_e - eval_e), na.rm = TRUE)
  M <- choose(length(ids), 2)
  candidate_bound <- selected$N * delta / M
  finite_regret_bound <- (selected$N + optimum_eval$N) * delta / M
  stopifnot(abs(r01 - r00) <= candidate_bound + 1e-12, r01 - r11 >= -1e-12,
            r01 - r11 <= finite_regret_bound + 1e-12)
  add(z$id, "another-law", list(means = vec(means), sds = vec(sds), ids = vec(ids),
    unit = 2L, shift = z$shift, scale = z$scale, tau = z$tau, family = z$family), list(
      selectedGrade = vec(selected$grade), evaluationGrade = vec(optimum_eval$grade),
      selectionFamilySize = selected$familySize, evaluationFamilySize = optimum_eval$familySize,
      selectedN = selected$N, evaluationN = optimum_eval$N,
      r00 = r00, r01 = r01, r10 = r10, r11 = r11,
      candidateShift = r01 - r00, candidateDiscrepancy = abs(r01 - r00), regret = r01 - r11,
      delta = delta, deltaW = delta, candidateBound = candidate_bound,
      regretBound = finite_regret_bound, uniformBound = 2 * delta))
}

# Relational comparison uses the common units. Canonicalization never changes a relation.
relation_change <- function(before, after) {
  n <- length(before)
  stopifnot(length(after) == n)
  a <- outer(before, before, function(x, y) sign(y - x))
  b <- outer(after, after, function(x, y) sign(y - x))
  ix <- upper.tri(a)
  a <- a[ix]; b <- b[ix]
  M <- choose(n, 2)
  list(M = M, nSame = sum(a == b), nNewDisclosed = sum(a == 0 & b != 0),
       nNewWithheld = sum(a != 0 & b == 0), nReversed = sum(a != 0 & b == -a),
       agreement = sum(a == b) / M)
}
correction_cases <- list(
  list(id = "one-correction-mean-low", mode = "mean", unit = 2L, value = -1, cap = 3L),
  list(id = "one-correction-none", mode = "mean", unit = 2L, value = .25, cap = 3L),
  list(id = "one-correction-sd", mode = "sd", unit = 0L, value = 1, cap = 2L),
  list(id = "one-correction-drop", mode = "drop", unit = 4L, value = 0, cap = 4L)
)
for (z in correction_cases) {
  unit <- z$unit + 1L
  family <- list(kind = "atMost", G = z$cap)
  before <- optimum(base_e, .2, family)
  common <- if (z$mode == "drop") setdiff(seq_along(ids), unit) else seq_along(ids)
  changed_mean <- means
  changed_sd <- sds
  if (z$mode == "mean") changed_mean[unit] <- z$value
  if (z$mode == "sd") changed_sd[unit] <- z$value
  changed_e <- normal_e(changed_mean[common], changed_sd[common])
  after <- optimum(changed_e, .2, family)
  common_before <- canon(before$grade[common])
  overall <- relation_change(common_before, after$grade)
  untouched <- setdiff(seq_along(ids), unit)
  in_after <- match(untouched, common)
  untouched_before <- canon(before$grade[untouched])
  untouched_after <- canon(after$grade[in_after])
  change_untouched <- relation_change(untouched_before, untouched_after)
  overall_agreement <- overall$agreement; overall$agreement <- NULL
  untouched_agreement <- change_untouched$agreement; change_untouched$agreement <- NULL
  coefficient_gap <- max(abs(base_e[untouched, untouched] - changed_e[in_after, in_after]), na.rm = TRUE)
  stopifnot(coefficient_gap == 0,
            overall$nSame + overall$nNewDisclosed + overall$nNewWithheld + overall$nReversed == overall$M)
  add(z$id, "one-correction", list(means = vec(means), sds = vec(sds), ids = vec(ids),
    mode = z$mode, unit = z$unit, value = z$value, cap = z$cap, tau = .2), list(
      beforeGrade = vec(before$grade), afterGrade = vec(after$grade),
      commonBeforeGrade = vec(common_before), commonAfterGrade = vec(after$grade), commonIds = vec(ids[common]),
      beforeRisk = before$risk, afterRisk = after$risk,
      beforeN = before$N, afterN = after$N, beforeEw = before$Ew, afterEw = after$Ew,
      beforeEoverN = before$EoverN, afterEoverN = after$EoverN,
      beforeFamilySize = before$familySize, afterFamilySize = after$familySize,
      beforeTieCount = before$tieCount, afterTieCount = after$tieCount,
      overall = overall, overallAgreement = overall_agreement,
      untouched = change_untouched, untouchedAgreement = untouched_agreement, untouchedEpsilon = coefficient_gap))
}


# V1 coupling: fixed directional probabilities do not identify a joint wrong-count law.
# Orders ABC, ACB, BAC, BCA, CBA are represented by strictly descending score ranks.
coupling_states <- lapply(list(c(3, 2, 1), c(3, 1, 2), c(2, 3, 1),
                              c(1, 3, 2), c(1, 2, 3)), cbind)
coupling_json <- function(states) lapply(states, function(m) lapply(seq_len(nrow(m)), function(i) vec(m[i, ])))
coupling_summary <- function(g, states, probs) {
  stated <- which(outer(g, g, "<"), arr.ind = TRUE)
  N <- nrow(stated)
  wrong <- vapply(states, function(m) {
    if (N == 0L) return(0L)
    sum(vapply(seq_len(N), function(j) m[stated[j, 1], 1] <= m[stated[j, 2], 1], TRUE))
  }, 0L)
  values <- sort(unique(wrong))
  E <- sum(probs * wrong)
  list(N = N, E = E, EoverN = if (N > 0L) E / N else NULL,
       pNone = sum(probs[wrong == 0L]), unionBound = max(0, 1 - E),
       values = vec(values), probs = vec(vapply(values, function(d) sum(probs[wrong == d]), 0)))
}
for (u in c(0, .05, .1)) {
  probs <- c(.6 - u, .15 + u, .15, u, .1 - u)
  pair_error <- function(i, j) sum(probs[vapply(coupling_states, function(m) m[i, 1] <= m[j, 1], TRUE)])
  pair_errors <- c(pair_error(1, 2), pair_error(2, 3), pair_error(1, 3))
  stopifnot(max(abs(pair_errors - c(.25, .25, .1))) < 1e-14)
  for (g in list(c(1L, 1L, 2L), c(1L, 2L, 3L), c(1L, 1L, 1L))) {
    z <- coupling_summary(g, coupling_states, probs)
    if (identical(g, c(1L, 1L, 2L))) stopifnot(abs(z$EoverN - .175) < 1e-14,
      abs(z$pNone - (.75 - u)) < 1e-14, abs(z$unionBound - .65) < 1e-14)
    if (identical(g, c(1L, 1L, 1L))) stopifnot(z$N == 0L, z$pNone == 1, is.null(z$EoverN))
    add(paste0("coupling-u", format(u, trim = TRUE), "-g", paste(g, collapse = "")), "coupling", list(
      u = u, g = vec(g), states = coupling_json(coupling_states), probs = vec(probs)),
      c(z, list(pairErrors = vec(pair_errors))))
  }
}
# Base-R seeded stream and the documented strict cumulative finite-law rule; compare outcomes,
# not an assumed latent-index field on a returned draw object.
mc_probs <- c(.5, .25, .15, .1, 0)
mc_u <- prx_uniforms(1L, 100L)
mc_cumulative <- cumsum(mc_probs)
mc_indices <- vapply(mc_u, function(v) {
  hits <- which(v < mc_cumulative)
  if (length(hits)) hits[1L] else length(mc_probs)
}, 0L)
mc_states <- coupling_states[mc_indices]
mc_summary <- coupling_summary(c(1L, 1L, 2L), mc_states, rep(1 / 100, 100))
mc_wrong <- vapply(mc_states, function(m) sum(c(m[1, 1] <= m[3, 1], m[2, 1] <= m[3, 1])), 0L)
add("coupling-u0.1-g112-S100-seed1", "coupling-mc", list(u = .1, g = vec(c(1L, 1L, 2L)),
  states = coupling_json(coupling_states), probs = vec(mc_probs), S = 100L, seed = 1L),
  c(mc_summary, list(wrongCounts = vec(mc_wrong))))

# The normal-pair boundary is computed from pnorm directly, before any JS adapter is run.
boundary_error <- pnorm((.81 - 2) / sqrt(1^2 + 1^2))
boundary_pi <- pnorm((2 - .81) / sqrt(1^2 + 1^2))
add("coherence-boundary-omega81", "normal-pair-boundary", list(
  meanA = 2, sdA = 1, meanB = .81, sdB = 1), list(error = boundary_error, pi = boundary_pi))


# Counterpart family at the requested tau boundary: enumerate every report in base R.
# Keep complete tied grade vectors and raw stated counts, not only the first optimum.
family_boundary_tau <- .144422183173242
family_boundary_tolerance <- 1e-12
family_boundary <- function(family) {
  g <- reports(length(ids), family)
  risk <- apply(g, 1, oracle_risk, e = base_e, tau = family_boundary_tau)
  optimum_risk <- min(risk)
  tied <- which(abs(risk - optimum_risk) <= family_boundary_tolerance)
  list(summary = list(familySize = nrow(g), tieCount = length(tied),
    grades = lapply(tied, function(i) vec(as.integer(g[i, ]))),
    Ns = vec(vapply(tied, function(i) oracle_report_counts(g[i, ], base_e)$N, 0L))),
    risk = optimum_risk)
}
family_boundary_all <- family_boundary(list(kind = "all"))
family_boundary_cap3 <- family_boundary(list(kind = "atMost", G = 3L))
add("tau-family-counterpart-boundary", "tau-family-boundary", list(
  means = vec(means), sds = vec(sds), ids = vec(ids), tau = family_boundary_tau,
  tieTol = family_boundary_tolerance), list(all = family_boundary_all$summary,
  cap3 = family_boundary_cap3$summary, tieTol = family_boundary_tolerance,
  allRisk = family_boundary_all$risk, cap3Risk = family_boundary_cap3$risk))

# Four-unit/two-criterion tie display at tau .10: independent finite-event arithmetic.
# State1 orders ABCD/ACBD; state2 BACD/DCBA, with masses3/4,1/4.
fam_states <- list(cbind(c(4,3,2,1),c(4,2,3,1)),cbind(c(3,4,2,1),c(1,2,3,4)))
fam_probs <- c(.75,.25)
fam_error <- .6*finite_coefficients(do.call(rbind,lapply(fam_states,function(m)m[,1])),fam_probs)$e +
  .4*finite_coefficients(do.call(rbind,lapply(fam_states,function(m)m[,2])),fam_probs)$e
fam_all <- reports(4L,list(kind="all"))
fam_summary <- function(g) {
  risks <- apply(g,1,oracle_risk,e=fam_error,tau=.1)
  ix <- which(abs(risks-min(risks))<=1e-12)
  list(familySize=nrow(g),tieCount=length(ix),grades=lapply(ix,function(i)vec(as.integer(g[i,]))),
       Ns=vec(vapply(ix,function(i)oracle_report_counts(g[i,],fam_error)$N,0L)))
}
fam_json <- lapply(fam_states,function(m)lapply(seq_len(nrow(m)),function(i)vec(m[i,])))
add("families-tb14-tau10-ties","finite-family-ties",list(states=fam_json,probs=vec(fam_probs),w=vec(c(.6,.4)),tau=.1,tieTol=1e-12),
  list(all=fam_summary(fam_all),cap3=fam_summary(fam_all[apply(fam_all,1,max)<=3,,drop=FALSE]),
       order=fam_summary(fam_all[apply(fam_all,1,function(g)all(diff(g)>=0)),,drop=FALSE]),tieTol=1e-12))

# Exact-price boundary of two-denominators: ties can change E/N even at equal risk.
den_tau <- .188379558905791
den_g <- reports(6L,list(kind="all"));den_r <- apply(den_g,1,oracle_risk,e=base_e,tau=den_tau)
den_ix <- which(abs(den_r-min(den_r))<=1e-12)
den_counts <- lapply(den_ix,function(i)counts(den_g[i,],base_e,den_tau))
add("denominator-tie-boundary","denominator-tie",list(means=vec(means),sds=vec(sds),ids=vec(ids),tau=den_tau),
 list(tieCount=length(den_ix),tieTol=1e-12,grades=lapply(den_ix,function(i)vec(as.integer(den_g[i,]))),
 Ns=vec(vapply(den_counts,function(z)z$N,0L)),EoverMs=vec(vapply(den_counts,function(z)z$Ew/15,0)),
 EoverNs=vec(vapply(den_counts,function(z)z$EoverN,0))))

write_golden("oracle-v3p2-readouts", rows, generator = "r-export/19_v3_part2_readouts.R", uses_postrank = FALSE)
cat("oracle-v3p2-readouts:", length(rows), "rows; independent finite-law arithmetic and Gaussian enumeration\n")
for (r in rows) cat(r$id, if (!is.null(r$expect$grade)) paste(r$expect$grade, collapse = "/") else "", "\n")
