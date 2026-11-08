# Author: JoonHo Lee (jlee296@ua.edu)
# Self-contained reproduction of Explorer P.3 with public postrank 1.2.0 functions.
# Original recipe code: MIT. The specified fictional law is teaching material.
# Download this file, then source it and call profile_dependence().
# It needs no private data, browser output, repository helper or optimiser backend.

profile_dependence <- function(c_values = c("0", "1/100", "1/20", "1/10")) {
  if (!requireNamespace("postrank", quietly = TRUE) ||
      as.character(utils::packageVersion("postrank")) != "1.2.0") {
    stop("This reproduction requires installed postrank 1.2.0.", call. = FALSE)
  }
  if (!requireNamespace("gmp", quietly = TRUE)) stop("Install the suggested package gmp.", call. = FALSE)
  if (!is.character(c_values) || !length(c_values) || length(c_values) > 11L ||
      anyNA(c_values) || any(!grepl("^(0|[1-9][0-9]*)(/[1-9][0-9]*)?$", c_values))) {
    stop("Supply one to eleven canonical rational coupling strings.", call. = FALSE)
  }
  couplings <- lapply(c_values, gmp::as.bigq)
  canonical <- vapply(couplings, as.character, "")
  if (!identical(unname(c_values), unname(canonical)) || anyDuplicated(canonical) ||
      any(vapply(couplings, function(c) c < gmp::as.bigq("0") || c > gmp::as.bigq("1/10"), TRUE))) {
    stop("Couplings must be unique reduced fractions between 0 and 1/10.", call. = FALSE)
  }
  unit_ids <- c("A", "B"); domains <- c("S", "C")
  state_ids <- c("++", "-+", "+-", "--")
  states <- array(0, c(4L, 2L, 2L), dimnames = list(state_ids, unit_ids, domains))
  a_targets <- rbind(c(1, 1), c(-1, 1), c(1, -1), c(-1, -1))
  for (s in seq_len(4L)) states[s, "A", ] <- a_targets[s, ]
  targets <- setNames(lapply(domains, function(d) list(
    definition = paste("Fictional", d, "priority coordinate"), units = "illustrative score",
    orientation = "larger_is_higher", transformations = list(),
    equality_classes = setNames(unit_ids, unit_ids),
    equality_provenance = "No structural identity between A and B."
  )), domains)
  columns <- list(withhold = c(A = 1L, B = 1L), forward = c(A = 1L, B = 2L),
                  reverse = c(A = 2L, B = 1L))
  card_key <- function(G) paste0("p:", paste(vapply(seq_len(ncol(G)),
    function(d) paste(as.integer(G[, d]), collapse = ","), ""), collapse = "|"))
  cards <- lapply(seq_len(9L), function(k) {
    i <- (k - 1L) %/% 3L + 1L; j <- (k - 1L) %% 3L + 1L
    cbind(S = columns[[i]], C = columns[[j]])
  })
  names(cards) <- vapply(cards, card_key, "")

  cases <- lapply(seq_along(couplings), function(k) {
    c <- couplings[[k]]
    masses <- vapply(list(gmp::as.bigq("4/5") + c, gmp::as.bigq("1/10") - c,
                          gmp::as.bigq("1/10") - c, c), as.character, "")
    provenance <- list(
      input_id = paste0("p3-input-", canonical[k]), law_id = paste0("p3-law-", canonical[k]),
      proper_law = TRUE, producer = "JoonHo Lee: self-contained fictional teaching law",
      conditioning_info = "Specified law; no observations or sampled posterior draws.",
      joint_generation = "Each labelled matrix contains A and B in S and C together.",
      sampling_assumptions = list(finite_support_origin =
        "The four listed matrices exhaust the specified law, including zero-mass rows."))
    input <- postrank::postrank_mdomain_input(states, targets = targets, provenance = provenance,
      representation = "exact_finite_law", masses = masses, state_origin = NULL,
      equality_classes = NULL)
    decision <- postrank::postrank_mdomain_decision(
      weights = c(S = "1/2", C = "1/2"), tau = c(S = "1/4", C = "1/4"),
      scope = "all_pairs", q = NULL, t = c(S = "0", C = "0"), alpha = "3/20",
      expected = NULL, joint = NULL)
    family <- postrank::postrank_mdomain_family(input,
      columns = setNames(list(columns, columns), domains), order = NULL, cuts = NULL,
      max_grades = c(S = 2L, C = 2L), max_actions = 9L)
    fit <- postrank::postrank_mdomain_solve(input, family, decision = decision, max_actions = 9L)
    evaluations <- lapply(cards, function(G) postrank::postrank_mdomain_evaluate(
      input, G, decision = decision, mode = "joint", keep_traces = TRUE))
    table <- data.frame(
      card_id = names(cards),
      risk_exact = vapply(evaluations, function(x) x$risk_exact, ""),
      joint_probability_exact = vapply(evaluations, function(x) x$J_exact, ""),
      feasible = vapply(evaluations, function(x) isTRUE(x$feasible_for_represented_measure), TRUE),
      stringsAsFactors = FALSE)
    feasible <- which(table$feasible)
    values <- gmp::as.bigq(table$risk_exact[feasible])
    optimisers <- feasible[as.logical(values == min(values))]
    selected_grades <- postrank::postrank_mdomain_grades(fit)
    selected_id <- card_key(selected_grades)
    table$optimal <- seq_len(nrow(table)) %in% optimisers
    table$selected <- table$card_id == selected_id
    native <- fit$candidate_table
    stopifnot(nrow(native) == 9L, fit$optimizer_count == length(optimisers),
      identical(selected_id, table$card_id[optimisers[1L]]),
      identical(unname(as.character(native$risk_exact)), unname(table$risk_exact)),
      identical(unname(as.character(native$J_exact)), unname(table$joint_probability_exact)),
      identical(unname(native$feasible_for_represented_measure), unname(table$feasible)),
      identical(unname(native$optimal), unname(table$optimal)),
      identical(unname(native$selected), unname(table$selected)))
    selected <- postrank::postrank_mdomain_evaluate(input, selected_grades,
      decision = decision, mode = "joint", keep_traces = TRUE)
    dual <- evaluations[["p:1,2|1,2"]]
    stopifnot(identical(dual$risk_exact, "1/10"),
      identical(dual$J_exact, as.character(gmp::as.bigq("1/5") - c)))
    if (c < gmp::as.bigq("1/20")) {
      stopifnot(length(optimisers) == 2L, selected$risk_exact == "7/40")
    } else stopifnot(length(optimisers) == 1L, selected$risk_exact == "1/10")
    list(c = canonical[k], masses = masses, input = input, decision = decision,
      family = family, fit = fit, evaluation = selected, candidate_table = table,
      optimiser_grades = cards[optimisers], selected_grades = selected_grades,
      summary = data.frame(c = canonical[k], risk_exact = selected$risk_exact,
        joint_probability_exact = selected$J_exact, feasible_cards = length(feasible),
        optimiser_count = length(optimisers),
        optimiser_ids = paste(table$card_id[optimisers], collapse = "; "),
        selected_id = selected_id, stringsAsFactors = FALSE))
  })
  names(cases) <- paste0("c=", canonical)
  list(summary = do.call(rbind, lapply(cases, `[[`, "summary")), cases = cases,
       scope = "Exact complete teaching laws; nine-card candidate product; no intended-posterior certificate.")
}

if (sys.nframe() == 0L) {
  result <- profile_dependence()
  print(result$summary, row.names = FALSE)
}
