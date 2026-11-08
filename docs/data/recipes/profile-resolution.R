# Author: JoonHo Lee (jlee296@ua.edu)
# Self-contained Explorer P.4 reproduction through public postrank 1.2.0 functions.
# Original recipe code: MIT; complete fictional laws are teaching material.
# Source this file, then call profile_resolution() for all twenty-one settings.
# No private data, browser result or repository helper is required.

profile_resolution <- function() {
  if (!requireNamespace("postrank", quietly = TRUE) ||
      as.character(utils::packageVersion("postrank")) != "1.2.0") {
    stop("This reproduction requires installed postrank 1.2.0.", call. = FALSE)
  }
  if (!requireNamespace("gmp", quietly = TRUE)) stop("Install the suggested package gmp.", call. = FALSE)
  units <- c("A", "B"); domains <- c("S", "C")
  budgets <- c("0", "1/40", "1/20", "3/40", "1/10", "1/8", "3/20")
  columns <- list(withhold = c(A = 1L, B = 1L), forward = c(A = 1L, B = 2L),
                  reverse = c(A = 2L, B = 1L))
  card_key <- function(G) paste0("p:", paste(vapply(seq_len(ncol(G)),
    function(d) paste(as.integer(G[, d]), collapse = ","), ""), collapse = "|"))
  cards <- lapply(seq_len(9L), function(i) {
    s <- (i - 1L) %/% 3L + 1L; c <- (i - 1L) %% 3L + 1L
    cbind(S = columns[[s]], C = columns[[c]])
  })
  names(cards) <- vapply(cards, card_key, "")
  state_ids <- c("s1", "s2", "s3")
  states <- array(0, c(3L, 2L, 2L), dimnames = list(state_ids, units, domains))
  rows_a <- rbind(c(1, 1), c(-1, 1), c(1, -1))
  for (s in seq_len(3L)) states[s, "A", ] <- rows_a[s, ]
  targets <- setNames(lapply(domains, function(d) list(
    definition = paste("Fictional", d, "priority coordinate"), units = "illustrative score",
    orientation = "larger_is_higher", transformations = list(),
    equality_classes = setNames(units, units),
    equality_provenance = "No structural identity between A and B."
  )), domains)
  cases <- list(); frontiers <- list()
  for (k in 0:2) {
    k_exact <- gmp::as.bigq(as.character(k))
    masses <- vapply(list(gmp::as.bigq("1") - gmp::as.bigq("3/20") * k_exact,
      k_exact / gmp::as.bigq("20"), k_exact / gmp::as.bigq("10")), as.character, "")
    previous_feasible <- character(); previous_risk <- NULL; rows <- list()
    for (a in seq_along(budgets)) {
      alpha <- budgets[a]; case_id <- paste0("resolution-k", k, "-a", a - 1L)
      provenance <- list(input_id = paste0(case_id, "-input"), law_id = paste0("resolution-k", k, "-law"),
        proper_law = TRUE, producer = "JoonHo Lee: self-contained fictional teaching law",
        conditioning_info = "Specified finite law, with no observations or sampled draws.",
        joint_generation = "Every labelled matrix contains A and B in S and C together.",
        sampling_assumptions = list(finite_support_origin =
          "The three listed matrices exhaust the law, including declared zero-mass states."))
      input <- postrank::postrank_mdomain_input(states, targets = targets, provenance = provenance,
        representation = "exact_finite_law", masses = masses, state_origin = NULL,
        equality_classes = NULL)
      decision <- postrank::postrank_mdomain_decision(weights = c(S = "1/4", C = "3/4"),
        tau = c(S = "1/4", C = "1/4"), scope = "all_pairs", q = NULL,
        t = c(S = "0", C = "0"), alpha = alpha, expected = NULL, joint = NULL)
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
      values <- gmp::as.bigq(table$risk_exact)
      minimum <- min(values[table$feasible])
      optimum_indices <- which(table$feasible & as.logical(values == minimum))
      optimizer_ids <- table$card_id[optimum_indices]
      selected_grades <- postrank::postrank_mdomain_grades(fit)
      selected_id <- card_key(selected_grades)
      selected <- evaluations[[selected_id]]
      table$optimal <- seq_len(9L) %in% optimum_indices
      table$selected <- table$card_id == selected_id
      native <- fit$candidate_table
      stopifnot(nrow(native) == 9L, fit$optimizer_count == length(optimizer_ids),
        identical(selected_id, optimizer_ids[1L]),
        identical(unname(as.character(native$risk_exact)), unname(table$risk_exact)),
        identical(unname(as.character(native$J_exact)), unname(table$joint_probability_exact)),
        identical(unname(native$feasible_for_represented_measure), unname(table$feasible)),
        identical(unname(native$optimal), unname(table$optimal)),
        identical(unname(native$selected), unname(table$selected)),
        all(previous_feasible %in% feasible_ids))
      if (!is.null(previous_risk)) stopifnot(minimum <= previous_risk)
      previous_feasible <- feasible_ids; previous_risk <- minimum
      optimizer_grade_counts <- lapply(evaluations[optimizer_ids], function(x) x$action$K)
      summary <- data.frame(case_id = case_id, noise_index = k, budget_index = a - 1L,
        alpha = alpha, reversal_s_exact = as.character(k_exact / gmp::as.bigq("20")),
        reversal_c_exact = as.character(k_exact / gmp::as.bigq("10")),
        feasible_count = length(feasible_ids), risk_exact = as.character(minimum),
        joint_probability_exact = selected$J_exact,
        grade_count_s = unname(selected$action$K["S"]),
        grade_count_c = unname(selected$action$K["C"]),
        disclosed_s = unname(selected$action$N["S"]), disclosed_c = unname(selected$action$N["C"]),
        optimizer_count = length(optimizer_ids), optimizer_ids = paste(optimizer_ids, collapse = "; "),
        selected_id = selected_id, stringsAsFactors = FALSE)
      cases[[case_id]] <- list(case_id = case_id, input = input, decision = decision, family = family,
        fit = fit, fixed_evaluations = evaluations, candidate_table = table, feasible_ids = feasible_ids,
        optimizer_grades = cards[optimum_indices], optimizer_grade_counts = optimizer_grade_counts,
        selected_grades = selected_grades, summary = summary)
      rows[[a]] <- summary
    }
    frontiers[[paste0("k", k)]] <- do.call(rbind, rows)
  }
  list(summary = do.call(rbind, lapply(cases, `[[`, "summary")), cases = cases, frontiers = frontiers,
    scope = paste("Complete finite teaching laws; fixed nine-card bank; exact represented-measure arithmetic.",
      "Budget nesting concerns each fixed law, policy loss and bank; no intended-posterior certificate is asserted."))
}

if (sys.nframe() == 0L) {
  result <- profile_resolution()
  print(result$summary, row.names = FALSE)
}
