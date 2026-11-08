# Author: JoonHo Lee (jlee296@ua.edu)
# Complete finite-law dependence fixtures for Explorer P.3.
# Run from the repository root only after the shared v3.5 oracle helper gate passes.
# All expected evaluations come from the public postrank 1.2.0 API via _oracle.R.
# These are complete teaching laws, not sampled posterior draws.
source(file.path("r-export", "v35", "_oracle.R"))

args <- commandArgs(trailingOnly = TRUE)
if (length(args) > 1L) stop("Usage: Rscript r-export/v35/dependence.R [output-directory]")
out_dir <- if (length(args)) args[[1L]] else file.path("verification", "golden", "v35")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
generator <- "r-export/v35/dependence.R"

dependence_request <- function(c_exact, slug) {
  # Use the frozen portable request to retain ordered identities and declarations.
  fixture <- v35_read_fixture(file.path("engine", "schemas", "mdomain.example.json"))
  c_value <- gmp::as.bigq(c_exact)
  stopifnot(c_value >= gmp::as.bigq("0"), c_value <= gmp::as.bigq("1/10"))
  fixture$fixtureId <- paste0("dependence-", slug)
  fixture$description <- paste0(
    "Complete two-unit, two-domain law with marginal reversal probabilities 1/10; ",
    "joint reversal mass c=", as.character(c_value), ". Public R-oracle evaluation of all nine cards.")
  fixture$input$inputId <- paste0("dependence-input-", slug)
  fixture$input$lawId <- paste0("dependence-law-", slug)
  fixture$input$masses <- vapply(list(
    gmp::as.bigq("4/5") + c_value,
    gmp::as.bigq("1/10") - c_value,
    gmp::as.bigq("1/10") - c_value,
    c_value
  ), as.character, character(1))
  fixture$input$provenance$producer <- "JoonHo Lee: self-contained dependence teaching law"
  fixture$input$provenance$conditioningInfo <- "Specified finite law; no fitted observations or sampled draws."
  fixture$input$provenance$jointGeneration <-
    "Each labelled matrix contains both units and both domains; dependence is supplied by the exact masses."
  fixture$input$provenance$finiteSupportOrigin <-
    "The four listed matrices exhaust this specified law, including zero-mass rows."
  fixture$decision$decisionId <- "dependence-equal-weights-direct-union"
  fixture$decision$weights <- c("1/2", "1/2")
  fixture$decision$tau <- c("1/4", "1/4")
  fixture$decision["q"] <- list(NULL)
  fixture$decision$t <- c("0", "0")
  fixture$decision$alpha <- "3/20"
  fixture$family$familyId <- "dependence-nine-product-cards"
  fixture
}

# The two near-boundary laws supplement the four public interaction presets.
specs <- list(
  list(c = "0", slug = "disjoint"),
  list(c = "1/100", slug = "independent"),
  list(c = "49/1000", slug = "below-cap-boundary"),
  list(c = "1/20", slug = "at-cap-boundary"),
  list(c = "51/1000", slug = "above-cap-boundary"),
  list(c = "1/10", slug = "coincident")
)

summaries <- lapply(specs, function(spec) {
  request <- dependence_request(spec$c, spec$slug)
  result <- v35_oracle_fixture(request, generator = generator, fixed_cards = "all")
  fit <- result$expected$fit
  rows <- fit$candidateTable
  ids <- vapply(rows, `[[`, character(1), "candidateId")
  expected_order <- c(
    "p:1,1|1,1", "p:1,1|1,2", "p:1,1|2,1",
    "p:1,2|1,1", "p:1,2|1,2", "p:1,2|2,1",
    "p:2,1|1,1", "p:2,1|1,2", "p:2,1|2,1"
  )
  stopifnot(identical(ids, expected_order), length(result$expected$fixedCards) == 9L)
  c_value <- gmp::as.bigq(spec$c)
  above <- c_value >= gmp::as.bigq("1/20")
  expected_optimizers <- if (above) "p:1,2|1,2" else c("p:1,1|1,2", "p:1,2|1,1")
  stopifnot(
    identical(unname(unlist(fit$optimizerIds)), expected_optimizers),
    identical(fit$selectedId, expected_optimizers[[1L]]),
    identical(fit$riskExact, if (above) "1/10" else "7/40"),
    sum(vapply(rows, `[[`, logical(1), "optimal")) == length(expected_optimizers),
    sum(vapply(rows, `[[`, logical(1), "selected")) == 1L,
    sum(vapply(rows, `[[`, logical(1), "feasible")) == if (above) 4L else 3L
  )
  double <- rows[[match("p:1,2|1,2", ids)]]
  stopifnot(
    identical(double$riskExact, "1/10"),
    identical(double$jointProbabilityExact, as.character(gmp::as.bigq("1/5") - c_value)),
    identical(double$feasible, as.logical(above))
  )
  # Public fixed-card evaluations check both complete marginals and stored events.
  fixed_ids <- vapply(result$expected$fixedCards, `[[`, character(1), "cardId")
  double_eval <- result$expected$fixedCards[[match("p:1,2|1,2", fixed_ids)]]$evaluation
  stopifnot(
    identical(unname(vapply(double_eval$domains, `[[`, character(1), "expectedFalseCountExact")), c("1/10", "1/10")),
    length(double_eval$states) == 4L
  )
  withheld_eval <- result$expected$fixedCards[[match("p:1,1|1,1", fixed_ids)]]$evaluation
  stopifnot(
    identical(withheld_eval$riskExact, "1/4"),
    identical(withheld_eval$jointProbabilityExact, "0"),
    identical(withheld_eval$jointStatus, "analytic_zero"),
    all(vapply(withheld_eval$domains, function(d) is.null(d$expectedFalseProportionExact), logical(1)))
  )
  path <- file.path(out_dir, paste0("dependence-", spec$slug, ".json"))
  v35_write_fixture(result, path)
  list(fixtureId = result$fixtureId, c = spec$c, file = path,
       riskExact = fit$riskExact, jointProbabilityExact = fit$jointProbabilityExact,
       optimizerIds = fit$optimizerIds, selectedId = fit$selectedId,
       candidateCount = length(rows), fixedCardCount = length(result$expected$fixedCards))
})
cat("PASS: six dependence fixtures; all nine public fixed-card evaluations and complete exact optimizer sets.\n")
for (x in summaries) cat(x$fixtureId, x$riskExact, x$selectedId, "\n")
