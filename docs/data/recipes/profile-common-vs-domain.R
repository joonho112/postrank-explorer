# Author: JoonHo Lee (jlee296@ua.edu)
# Self-contained Explorer P.1 reproduction through public postrank 1.2.0 functions.
# Original recipe code: MIT; specified fictional laws are teaching material.
# Source this file, then call profile_common_vs_domain(). Defaults cover all twelve
# law/cost/weight settings, including the four displayed presets and exact ties.
# No private file, browser result, repository helper or optimiser backend is needed.

profile_common_vs_domain <- function() {
  if (!requireNamespace("postrank", quietly = TRUE) ||
      as.character(utils::packageVersion("postrank")) != "1.2.0") {
    stop("This reproduction requires installed postrank 1.2.0.", call. = FALSE)
  }
  if (!requireNamespace("gmp", quietly = TRUE)) stop("Install the suggested package gmp.", call. = FALSE)
  units <- c("A", "B"); domains <- c("S", "C")
  columns <- list(withhold = c(A = 1L, B = 1L), forward = c(A = 1L, B = 2L),
                  reverse = c(A = 2L, B = 1L))
  card_key <- function(G) paste0("p:", paste(vapply(seq_len(ncol(G)),
    function(d) paste(as.integer(G[, d]), collapse = ","), ""), collapse = "|"))
  cards <- lapply(seq_len(9L), function(k) {
    i <- (k - 1L) %/% 3L + 1L; j <- (k - 1L) %% 3L + 1L
    cbind(S = columns[[i]], C = columns[[j]])
  })
  names(cards) <- vapply(cards, card_key, "")
  common_indices <- which(vapply(cards, function(G) identical(G[, 1L], G[, 2L]), TRUE))
  stopifnot(length(common_indices) == 3L)
  targets <- setNames(lapply(domains, function(d) list(
    definition = paste("Fictional", d, "priority coordinate"), units = "illustrative score",
    orientation = "larger_is_higher", transformations = list(),
    equality_classes = setNames(units, units),
    equality_provenance = "No structural identity between A and B."
  )), domains)
  costs <- c(low = "1/20", boundary = "1/10", ordinary = "1/4")
  settings <- list()
  for (law in c("aligned", "crossed")) for (cost in names(costs)) for (weight in c("equal", "one-heavy")) {
    settings[[length(settings) + 1L]] <- list(law = law, cost = cost, weight = weight)
  }
  cases <- lapply(settings, function(setting) {
    law <- setting$law; tau <- unname(costs[setting$cost])
    weights <- if (setting$weight == "equal") c(S = "1/2", C = "1/2") else c(S = "9/10", C = "1/10")
    case_id <- paste("common", law, setting$cost, setting$weight, sep = "-")
    states <- array(0, c(2L, 2L, 2L), dimnames = list(c("usual", "reversal"), units, domains))
    rows <- if (law == "aligned") rbind(c(1, 1), c(-1, -1)) else rbind(c(1, -1), c(-1, 1))
    for (s in seq_len(2L)) states[s, "A", ] <- rows[s, ]
    provenance <- list(input_id = paste0(case_id, "-input"), law_id = paste0("common-", law, "-law"),
      proper_law = TRUE, producer = "JoonHo Lee: self-contained fictional teaching law",
      conditioning_info = "Specified finite law, with no observations or sampled draws.",
      joint_generation = "Each labelled matrix contains A and B in both S and C together.",
      sampling_assumptions = list(finite_support_origin = "The two listed matrices exhaust the specified law."))
    input <- postrank::postrank_mdomain_input(states, targets = targets, provenance = provenance,
      representation = "exact_finite_law", masses = c("9/10", "1/10"),
      state_origin = NULL, equality_classes = NULL)
    decision <- postrank::postrank_mdomain_decision(weights = weights,
      tau = setNames(rep(tau, 2L), domains), scope = "all_pairs", q = NULL, t = NULL,
      alpha = "3/20", expected = NULL, joint = NULL)
    family <- postrank::postrank_mdomain_family(input,
      columns = setNames(list(columns, columns), domains), order = NULL, cuts = NULL,
      max_grades = c(S = 2L, C = 2L), max_actions = 9L)
    fit <- postrank::postrank_mdomain_solve(input, family, decision = decision, max_actions = 9L)
    evaluations <- lapply(cards, function(G) postrank::postrank_mdomain_evaluate(
      input, G, decision = decision, mode = "joint", keep_traces = TRUE))
    table <- data.frame(card_id = names(cards),
      risk_exact = vapply(evaluations, function(x) x$risk_exact, ""),
      feasible = vapply(evaluations, function(x) isTRUE(x$feasible_for_represented_measure), TRUE),
      stringsAsFactors = FALSE)
    stopifnot(nrow(table) == 9L, all(table$feasible),
      all(vapply(evaluations, function(x) identical(x$status$joint, "disabled"), TRUE)))
    values <- gmp::as.bigq(table$risk_exact)
    product_indices <- which(as.logical(values == min(values)))
    # Common cards are the listed three-card diagonal, not another Cartesian bank.
    common_values <- values[common_indices]
    common_optima <- common_indices[as.logical(common_values == min(common_values))]
    common_risk <- as.character(min(common_values)); profile_risk <- as.character(min(values))
    gap <- min(common_values) - min(values)
    stopifnot(gap >= gmp::as.bigq("0"))
    selected_grades <- postrank::postrank_mdomain_grades(fit)
    selected_id <- card_key(selected_grades)
    table$common_card <- seq_len(9L) %in% common_indices
    table$profile_optimal <- seq_len(9L) %in% product_indices
    table$common_optimal <- seq_len(9L) %in% common_optima
    table$profile_selected <- table$card_id == selected_id
    native <- fit$candidate_table
    stopifnot(fit$optimizer_count == length(product_indices),
      identical(selected_id, table$card_id[product_indices[1L]]),
      identical(unname(as.character(native$risk_exact)), unname(table$risk_exact)),
      identical(unname(native$optimal), unname(table$profile_optimal)),
      identical(unname(native$selected), unname(table$profile_selected)))
    list(case_id = case_id, input = input, decision = decision, family = family,
      profile_fit = fit, fixed_evaluations = evaluations, candidate_table = table,
      profile_optimizer_grades = cards[product_indices],
      common = list(scope = "listed_subset", candidate_ids = table$card_id[common_indices],
        optimizer_ids = table$card_id[common_optima], selected_id = table$card_id[common_optima[1L]],
        optimizer_grades = cards[common_optima], risk_exact = common_risk),
      summary = data.frame(case_id = case_id, law = law, tau = tau, weight_scenario = setting$weight,
        common_risk_exact = common_risk, profile_risk_exact = profile_risk,
        risk_gap_exact = as.character(gap), common_optimizer_count = length(common_optima),
        profile_optimizer_count = length(product_indices),
        common_optimizer_ids = paste(table$card_id[common_optima], collapse = "; "),
        profile_optimizer_ids = paste(table$card_id[product_indices], collapse = "; "),
        profile_selected_id = selected_id, stringsAsFactors = FALSE))
  })
  names(cases) <- vapply(cases, `[[`, "", "case_id")
  list(summary = do.call(rbind, lapply(cases, `[[`, "summary")), cases = cases,
    scope = paste("Complete finite teaching laws; same loss and policy for three listed common cards",
      "and nine product cards. Expected and joint guards are disabled; no posterior certificate."))
}

if (sys.nframe() == 0L) {
  result <- profile_common_vs_domain()
  print(result$summary, row.names = FALSE)
}
