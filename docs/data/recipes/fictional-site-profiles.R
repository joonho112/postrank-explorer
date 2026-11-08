# Author: JoonHo Lee (jlee296@ua.edu)
# Display-only reproduction of Explorer P.5 from the public postrank 1.2.0 asset.
# Original recipe code: MIT. Bundled illustration content: CC BY 4.0, JoonHo Lee.
# Source: https://github.com/joonho112/need-based-prek-funding-tutorial
# This script reads saved grades and empirical summaries; it performs no fit or search.

fictional_site_profiles <- function() {
  if (!requireNamespace("postrank", quietly = TRUE) ||
      as.character(utils::packageVersion("postrank")) != "1.2.0") {
    stop("This reproduction requires installed postrank 1.2.0.", call. = FALSE)
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Install jsonlite.", call. = FALSE)
  path <- system.file("extdata", "mdomain", "synthetic40-card.json", package = "postrank", mustWork = TRUE)
  asset <- jsonlite::read_json(path, simplifyVector = FALSE)
  stopifnot(identical(asset$schema_version, "postrank-frozen-synthetic40-card-v1"),
    identical(asset$assurance$intended_posterior_feasibility_certified, FALSE),
    identical(asset$original_source$chain_split_establishes_independence, FALSE))
  fraction_parts <- function(x) {
    parts <- strsplit(x, "/", fixed = TRUE)[[1L]]
    c(numerator = as.integer(parts[1L]), denominator = if (length(parts) == 2L) as.integer(parts[2L]) else 1L)
  }
  cutoff <- function(t, N) {
    # The mathematical cutoff is 1 at N=0; its event remains inactive below.
    f <- fraction_parts(t)
    as.integer((f["numerator"] * N) %/% f["denominator"] + 1L)
  }
  exceeds <- function(F, N, t) {
    if (N == 0L) return(FALSE)
    f <- fraction_parts(t)
    F * f["denominator"] > f["numerator"] * N
  }
  scenarios <- c(primary = "main-alpha-1_20", wide = "sensitivity-t-wide")
  cases <- lapply(names(scenarios), function(scenario) {
    stored <- asset$cases[[which(vapply(asset$cases, function(x) x$case_id, "") == scenarios[scenario])]]
    grades <- data.frame(site_id = vapply(asset$grades, function(x) x$unit_id, ""),
      S = vapply(asset$grades, function(x) as.integer(x[[paste0(scenario, "_S")]]), 0L),
      C = vapply(asset$grades, function(x) as.integer(x[[paste0(scenario, "_C")]]), 0L),
      stringsAsFactors = FALSE)
    stopifnot(nrow(grades) == 40L, !anyDuplicated(grades$site_id))
    K <- c(S = max(grades$S), C = max(grades$C))
    occupancy <- matrix(0L, nrow = K["C"], ncol = K["S"],
      dimnames = list(C = as.character(seq_len(K["C"])), S = as.character(seq_len(K["S"]))))
    cells <- list()
    for (c in seq_len(K["C"])) for (s in seq_len(K["S"])) {
      members <- grades$site_id[grades$S == s & grades$C == c]
      occupancy[c, s] <- length(members)
      cells[[paste(c, s, sep = ",")]] <- list(grade_c = c, grade_s = s,
        count = length(members), members = members)
    }
    pairs <- lapply(seq_len(nrow(grades) - 1L), function(i) lapply((i + 1L):nrow(grades), function(j) {
      # Positive direction means the first site has the higher reported priority.
      direction_s <- sign(grades$S[j] - grades$S[i]); direction_c <- sign(grades$C[j] - grades$C[i])
      class <- if (direction_s == 0L && direction_c == 0L) "neither" else
        if (direction_s == 0L) "C_only" else if (direction_c == 0L) "S_only" else
          if (direction_s == direction_c) "same" else "crossed"
      data.frame(pair_id = paste(grades$site_id[c(i, j)], collapse = "|"),
        first = grades$site_id[i], second = grades$site_id[j],
        direction_s = as.integer(direction_s), direction_c = as.integer(direction_c),
        disclosed_s = direction_s != 0L, disclosed_c = direction_c != 0L,
        pair_class = class, stringsAsFactors = FALSE)
    }))
    pairs <- do.call(rbind, unlist(pairs, recursive = FALSE))
    pair_counts <- setNames(vapply(c("neither", "C_only", "S_only", "same", "crossed"),
      function(class) sum(pairs$pair_class == class), 0L), c("neither", "C_only", "S_only", "same", "crossed"))
    N <- c(S = sum(pairs$disclosed_s), C = sum(pairs$disclosed_c))
    stopifnot(nrow(pairs) == 780L, sum(occupancy) == 40L,
      unname(N["S"]) == stored$N_S, unname(N["C"]) == stored$N_C)
    domain_summary <- data.frame(domain = c("S", "C"), disclosed_pairs = unname(N),
      threshold_exact = rep(stored$t, 2L),
      first_strict_exceedance_count = vapply(unname(N), function(n) cutoff(stored$t, n), 0L),
      event_active = unname(N) > 0L,
      expected_false_count_exact = rep(NA_character_, 2L),
      expected_false_proportion_exact = rep(NA_character_, 2L),
      error_proportion_status = ifelse(unname(N) == 0L, "undefined_zero_disclosures", "not_stored"),
      stringsAsFactors = FALSE)
    primary_boundary <- if (scenario == "primary") data.frame(false_count = c(25L, 26L),
      disclosed_pairs = unname(N["C"]), threshold_exact = stored$t,
      strict_exceedance = vapply(c(25L, 26L), function(f) unname(exceeds(f, N["C"], stored$t)), TRUE),
      stringsAsFactors = FALSE) else NULL
    # Risk, J and historical optimizer counts are copied verbatim, never inferred from tuples.
    summary <- data.frame(scenario = scenario, case_id = stored$case_id, sites = nrow(grades),
      original_pairs = nrow(pairs), N_S = unname(N["S"]), N_C = unname(N["C"]),
      unique_disclosed_pairs = sum(pairs$disclosed_s | pairs$disclosed_c),
      crossed_pairs = unname(pair_counts["crossed"]), occupied_cells = sum(occupancy > 0L),
      total_cells = length(occupancy), stored_risk_exact = stored$risk_exact,
      stored_selection_J_exact = stored$selection_J_exact,
      stored_diagnostic_J_exact = stored$diagnostic_J_exact,
      stored_optimizer_count = stored$optimizer_count, stringsAsFactors = FALSE)
    list(scenario = scenario, case_id = stored$case_id, grades = grades, occupancy = occupancy,
      cells = cells, pairs = pairs, pair_class_counts = pair_counts, domain_summary = domain_summary,
      primary_boundary = primary_boundary, stored_results = stored, summary = summary)
  })
  names(cases) <- names(scenarios)
  list(summary = do.call(rbind, lapply(cases, `[[`, "summary")), cases = cases,
    attribution = asset$attribution, original_source = asset$original_source, targets = asset$targets,
    design = asset$design, assurance = asset$assurance,
    scope = paste("Display only: tuple-derived cells/pair directions/counts and copied empirical summaries.",
      "No posterior states are loaded; no solver or fitted object is created.",
      "Positive-disclosure expected-error fractions are not stored; no intended-posterior certificate is asserted."))
}

if (sys.nframe() == 0L) {
  result <- fictional_site_profiles()
  print(result$summary, row.names = FALSE)
  print(result$attribution)
}
