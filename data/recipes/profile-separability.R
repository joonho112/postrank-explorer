# Author: JoonHo Lee (jlee296@ua.edu)
# Self-contained Explorer P.2 reproduction through public postrank 1.2.0 functions.
# Original recipe code: MIT; complete fictional laws are teaching material.
# Source this file, then call profile_separability() for all twelve settings.
# The local helper uses no browser results, private data or repository functions.

profile_separability <- function() {
  if (!requireNamespace("postrank", quietly = TRUE) ||
      as.character(utils::packageVersion("postrank")) != "1.2.0") {
    stop("This reproduction requires installed postrank 1.2.0.", call. = FALSE)
  }
  if (!requireNamespace("gmp", quietly = TRUE)) stop("Install the suggested package gmp.", call. = FALSE)
  units <- c("A", "B"); domains <- c("S", "C")
  columns <- list(withhold = c(A = 1L, B = 1L), forward = c(A = 1L, B = 2L),
                  reverse = c(A = 2L, B = 1L))
  column_keys <- vapply(columns, function(x) paste(x, collapse = ","), "")
  card_key <- function(G) paste0("p:", paste(vapply(seq_len(ncol(G)),
    function(d) paste(as.integer(G[, d]), collapse = ","), ""), collapse = "|"))
  cards <- lapply(seq_len(9L), function(k) {
    i <- (k - 1L) %/% 3L + 1L; j <- (k - 1L) %% 3L + 1L
    cbind(S = columns[[i]], C = columns[[j]])
  })
  names(cards) <- vapply(cards, card_key, "")
  keys <- lapply(seq_len(2L), function(d) vapply(cards,
    function(G) paste(G[, d], collapse = ","), ""))
  product_ids <- function(projections) names(cards)[Reduce(`&`,
    Map(function(k, p) k %in% p, keys, projections))]
  state_ids <- c("++", "-+", "+-", "--")
  states <- array(0, c(4L, 2L, 2L), dimnames = list(state_ids, units, domains))
  rows_a <- rbind(c(1, 1), c(-1, 1), c(1, -1), c(-1, -1))
  for (s in seq_len(4L)) states[s, "A", ] <- rows_a[s, ]
  targets <- setNames(lapply(domains, function(d) list(
    definition = paste("Fictional", d, "priority coordinate"), units = "illustrative score",
    orientation = "larger_is_higher", transformations = list(),
    equality_classes = setNames(units, units),
    equality_provenance = "No structural identity between A and B."
  )), domains)
  couplings <- c(disjoint = "0", independent = "1/100", coincident = "1/10")
  settings <- list()
  for (law in names(couplings)) for (zero_weight in c(FALSE, TRUE)) for (guard in c(FALSE, TRUE)) {
    settings[[length(settings) + 1L]] <- list(law = law, zero_weight = zero_weight, guard = guard)
  }
  cases <- lapply(settings, function(setting) {
    law <- setting$law; c <- gmp::as.bigq(unname(couplings[law]))
    masses <- vapply(list(gmp::as.bigq("4/5") + c, gmp::as.bigq("1/10") - c,
      gmp::as.bigq("1/10") - c, c), as.character, "")
    weights <- if (setting$zero_weight) c(S = "0", C = "1") else c(S = "1/2", C = "1/2")
    case_id <- paste("separable", law, if (setting$zero_weight) "one-zero" else "equal",
      if (setting$guard) "guard-on" else "guard-off", sep = "-")
    provenance <- list(input_id = paste0(case_id, "-input"), law_id = paste0("separable-", law, "-law"),
      proper_law = TRUE, producer = "JoonHo Lee: self-contained fictional teaching law",
      conditioning_info = "Specified finite law, with no observations or sampled draws.",
      joint_generation = "Each labelled matrix contains A and B in S and C together.",
      sampling_assumptions = list(finite_support_origin =
        "The four listed matrices exhaust this law, including zero-mass endpoint rows."))
    input <- postrank::postrank_mdomain_input(states, targets = targets, provenance = provenance,
      representation = "exact_finite_law", masses = masses, state_origin = NULL,
      equality_classes = NULL)
    decision <- postrank::postrank_mdomain_decision(weights = weights,
      tau = c(S = "1/4", C = "1/4"), scope = "all_pairs", q = NULL,
      t = if (setting$guard) c(S = "0", C = "0") else NULL,
      alpha = "3/20", expected = NULL, joint = NULL)
    family <- postrank::postrank_mdomain_family(input,
      columns = setNames(list(columns, columns), domains), order = NULL, cuts = NULL,
      max_grades = c(S = 2L, C = 2L), max_actions = 9L)
    fit <- postrank::postrank_mdomain_solve(input, family, decision = decision, max_actions = 9L)
    evaluations <- lapply(cards, function(G) postrank::postrank_mdomain_evaluate(
      input, G, decision = decision, mode = "joint", keep_traces = TRUE))
    table <- data.frame(card_id = names(cards),
      risk_exact = vapply(evaluations, function(x) x$risk_exact, ""),
      joint_probability_exact = vapply(evaluations, function(x) x$J_exact, ""),
      feasible = vapply(evaluations, function(x) isTRUE(x$feasible_for_represented_measure), TRUE),
      stringsAsFactors = FALSE)
    feasible_ids <- table$card_id[table$feasible]
    projections <- lapply(keys, function(k) unname(unique(k[table$feasible])))
    projection_product_ids <- product_ids(projections)
    factors <- identical(feasible_ids, projection_product_ids)
    domain_tables <- lapply(seq_len(2L), function(d) {
      domain_values <- lapply(column_keys, function(k)
        evaluations[[match(k, keys[[d]])]]$domain_table[d, , drop = FALSE])
      values <- data.frame(column_id = unname(column_keys),
        loss_exact = vapply(domain_values, function(x) x$loss_exact, ""),
        weight_exact = rep(unname(weights[d]), 3L),
        weighted_loss_exact = vapply(domain_values, function(x) x$weighted_loss_exact, ""),
        in_projection = unname(column_keys) %in% projections[[d]], stringsAsFactors = FALSE)
      q <- gmp::as.bigq(values$weighted_loss_exact)
      minimum <- min(q[values$in_projection])
      values$weighted_argmin <- values$in_projection & as.logical(q == minimum)
      list(domain_id = domains[d], columns = values, projection_columns = projections[[d]],
        weighted_minimum_exact = as.character(minimum),
        weighted_argmin_columns = values$column_id[values$weighted_argmin])
    })
    names(domain_tables) <- domains
    preferred_ids <- product_ids(lapply(domain_tables, function(x) x$weighted_argmin_columns))
    preferred_feasible_ids <- preferred_ids[preferred_ids %in% feasible_ids]
    missing_preferred_ids <- preferred_ids[!preferred_ids %in% feasible_ids]
    lower_bound <- sum(gmp::as.bigq(vapply(domain_tables, function(x) x$weighted_minimum_exact, "")))
    values <- gmp::as.bigq(table$risk_exact)
    feasible_minimum <- min(values[table$feasible])
    optimum_indices <- which(table$feasible & as.logical(values == feasible_minimum))
    selected_id <- card_key(postrank::postrank_mdomain_grades(fit))
    table$optimal <- seq_len(9L) %in% optimum_indices
    table$selected <- table$card_id == selected_id
    optimizer_ids <- table$card_id[optimum_indices]
    preferred_equals_optimizers <- identical(preferred_ids, optimizer_ids)
    gap <- feasible_minimum - lower_bound
    stopifnot(gap >= gmp::as.bigq("0"))
    if (factors) stopifnot(preferred_equals_optimizers, gap == gmp::as.bigq("0"))
    native <- fit$candidate_table
    stopifnot(nrow(native) == 9L, fit$optimizer_count == length(optimizer_ids),
      identical(selected_id, optimizer_ids[1L]),
      identical(unname(as.character(native$risk_exact)), unname(table$risk_exact)),
      identical(unname(as.character(native$J_exact)), unname(table$joint_probability_exact)),
      identical(unname(native$feasible_for_represented_measure), unname(table$feasible)),
      identical(unname(native$optimal), unname(table$optimal)),
      identical(unname(native$selected), unname(table$selected)))
    list(case_id = case_id, c = as.character(c), input = input, decision = decision, family = family,
      fit = fit, fixed_evaluations = evaluations, candidate_table = table,
      optimizer_grades = cards[optimum_indices], domain_tables = domain_tables,
      feasible_ids = feasible_ids, projection_product_ids = projection_product_ids,
      missing_projection_ids = projection_product_ids[!projection_product_ids %in% feasible_ids],
      preferred_ids = preferred_ids, preferred_feasible_ids = preferred_feasible_ids,
      missing_preferred_ids = missing_preferred_ids,
      summary = data.frame(case_id = case_id, c = as.character(c), zero_weight_s = setting$zero_weight,
        joint_guard = setting$guard, feasible_count = length(feasible_ids),
        projection_count_s = length(projections[[1L]]), projection_count_c = length(projections[[2L]]),
        projection_product_count = length(projection_product_ids), feasible_family_factors = factors,
        preferred_product_count = length(preferred_ids), preferred_feasible_count = length(preferred_feasible_ids),
        preferred_missing_count = length(missing_preferred_ids), lower_bound_exact = as.character(lower_bound),
        risk_exact = as.character(feasible_minimum), risk_gap_exact = as.character(gap),
        lower_bound_attained = length(preferred_feasible_ids) > 0L,
        preferred_product_equals_optimizers = preferred_equals_optimizers,
        optimizer_count = length(optimizer_ids), optimizer_ids = paste(optimizer_ids, collapse = "; "),
        selected_id = selected_id, stringsAsFactors = FALSE))
  })
  names(cases) <- vapply(cases, `[[`, "", "case_id")
  list(summary = do.call(rbind, lapply(cases, `[[`, "summary")), cases = cases,
    scope = paste("Complete finite teaching laws; nine stated product cards; exact represented-measure arithmetic.",
      "Feasibility and projected minima concern this law; no intended-posterior certificate is asserted."))
}

if (sys.nframe() == 0L) {
  result <- profile_separability()
  print(result$summary, row.names = FALSE)
}
