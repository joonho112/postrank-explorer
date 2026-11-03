# Author: JoonHo Lee (jlee296@ua.edu)
# Released MCMC example for app 1.18 (chain-draws): postrank's pr_toy_mcmc and its postrank_diagnose() summary.
#   Rscript r-export/24_export_toy_mcmc.R
# Sources (read-only): postrank 1.1.0 data/pr_toy_mcmc.rda (four stationary two-state chains of 512 iterations, with
# its law attribute) and vignette m6's diagnostic call (postrank_draws(regime = "mcmc"), postrank_diagnose(); the
# posterior package computes R-hat, ESS and the MCMC MCSE). No downloads, no solves.
# Written: data/released/toy-mcmc.json and its classic-script twin, and the file's entry in data_contract.json.
# The chain state Z (0 or 1) of every draw is exported, not the 2048 x 3 x 2 array: state 0 gives A, B, C the targets
# (3, 2, 1) on k1 and (3, 1, 2) on k2, state 1 gives (1, 3, 2) and (1, 2, 3), so the array follows from Z (checked
# below). The pair indicator "A at or below B on k1" equals Z, and the fixed report's loss per draw is a function of Z.
prx_export_lib_only <- TRUE
source("r-export/20_export_teaching.R")
rm(prx_export_lib_only)

cat("24_export_toy_mcmc: data/released/toy-mcmc.json\n")
entries <- list()
keep <- function(w) { entries[[basename(w$path)]] <<- w$entry; invisible(w) }
env <- new.env()
utils::data(list = "pr_toy_mcmc", package = "postrank", envir = env)
x <- env$pr_toy_mcmc
law <- attr(x, "law")
stopifnot(identical(dim(x), c(2048L, 3L, 2L)))

# ---- the chain states, and the array rebuilt from them ----------------------------------------------------------------
n_chain <- 4L; S <- 512L
z <- as.integer(x[, "A", "k1"] == 1)                       # state 1: A's k1 target is 1
targets <- list(`0` = rbind(k1 = c(3, 2, 1), k2 = c(3, 1, 2)), `1` = rbind(k1 = c(1, 3, 2), k2 = c(1, 2, 3)))
rebuilt <- array(NA_real_, dim(x), dimnames(x))
for (s in seq_along(z)) rebuilt[s, , ] <- t(targets[[as.character(z[s])]])
stopifnot(identical(as.numeric(rebuilt), as.numeric(x)))       # the values (x also carries its law attribute)
chains <- lapply(seq_len(n_chain), function(c) z[((c - 1L) * S + 1L):(c * S)])

# ---- vignette m6's diagnostic call ----------------------------------------------------------------------------------
mc <- postrank_draws(x, regime = "mcmc", chains = n_chain, warmup_per_chain = 0L, thin = 1L, declarations = law$declarations)
grade <- c(A = 1L, B = 2L, C = 3L); weights <- c(k1 = .6, k2 = .4); tau <- .25
d <- postrank_diagnose(mc, grade = grade, settings = list(weights = weights, tau = tau),
                       pairs = data.frame(entity_i = "A", entity_j = "B", criterion_id = "k1"))
p <- d$summaries$pair_1; tl <- d$summaries$weighted_total_loss
pair_trace <- as.numeric(d$traces$pair_1$values)
stopifnot(identical(as.integer(pair_trace), z))             # the pair indicator is the chain state
loss_trace <- as.numeric(d$traces$weighted_total_loss$values)
loss_by_state <- vapply(c(0L, 1L), function(s) { v <- loss_trace[z == s]; stopifnot(diff(range(v)) < 1e-12); v[1] }, 0)
diag_value <- function(dg, k) as.numeric(dg[[k]]$value)

keep(write_released(list(
  facts = list(
    description = "Four stationary two-state Markov chains of 512 iterations each (pr_toy_mcmc), stored chain by chain.",
    transitions = list(p01 = 0.012, p10 = 0.048), stationary_p1 = 0.2, second_eigenvalue = 0.94,
    chains = n_chain, draws_per_chain = S, draws = n_chain * S,
    states = "State 0: A, B, C targets (3, 2, 1) on k1 and (3, 1, 2) on k2; state 1: (1, 3, 2) and (1, 2, 3).",
    pair = "A at or below B on k1 (the weak error of stating A above B); it equals the chain state.",
    fixed_report = list(grade = named(grade), weights = named(weights), tau = tau, loss_state0 = loss_by_state[1],
                        loss_state1 = loss_by_state[2]),
    known = list(pair_probability = 0.2, pooled_ones = sum(z), fixed_report_loss = 4 / 15,
                 law_optimum = "grades (1, 2, 2) with risk 13/60 under the known stationary law"),
    reading = "R-hat and ESS describe how this trace explores; they flag problems and establish nothing about the law."),
  tables = list(chains = tbl(chain = seq_len(n_chain), ones = vapply(chains, sum, 0L),
                             mean = vapply(chains, mean, 0), pair_chain_mean = as.numeric(p$chain_means))),
  summary = list(
    pair = list(mean = as.numeric(p$mean), rhat = diag_value(p$diagnostics, "rhat"),
                ess_bulk = diag_value(p$diagnostics, "ess_bulk"), ess_mean = diag_value(p$diagnostics, "ess_mean"),
                mcse_mean = diag_value(p$diagnostics, "mcse_mean"), iid_sd_over_sqrt_draws = sd(pair_trace) / sqrt(length(pair_trace))),
    loss = list(mean = as.numeric(tl$mean), mcse_mean = diag_value(tl$diagnostics, "mcse_mean"),
                rhat = diag_value(tl$diagnostics, "rhat"), ess_bulk = diag_value(tl$diagnostics, "ess_bulk")),
    warnings = length(d$warnings)),
  arrays = list(trace = list(states = lapply(chains, col)))),
  author_meta("toy-mcmc", "pr_toy_mcmc: a slowly mixing two-state chain and its diagnostics", "tables.chains",
              list(data_src("pr_toy_mcmc"),
                   list(object = "vignette m6 diagnostic call", path = sprintf("%s vignettes/m6-monte-carlo-uncertainty.Rmd", PKG),
                        fields = "postrank_draws(regime = \"mcmc\", chains = 4); postrank_diagnose() pair A, B on k1 and the fixed report (1, 2, 3), weights .6/.4, tau .25")),
              changes = "Chain states derived from the array (the array follows from them); diagnostics computed with postrank 1.1.0 and the posterior package; numbers with 15 significant digits.")))

update_contract(entries)

# ---- checks ---------------------------------------------------------------------------------------------------------
tm <- read_released("toy-mcmc")
expect_identical_val(as.integer(tm$facts$known$pooled_ones), 353L, "toy-mcmc: 353 ones in 2,048 draws (pooled mean 353/2048)")
expect_equal_num(tm$summary$pair$mean, 353 / 2048, 1e-15, "toy-mcmc: pooled pair mean = 353/2048")
expect_equal_num(round(tm$tables$chains$mean, 4), c(0.1426, 0.0859, 0.2441, 0.2168), 0, "toy-mcmc: chain means .1426, .0859, .2441, .2168")
expect_equal_num(round(c(tm$summary$pair$rhat, tm$summary$pair$ess_bulk, tm$summary$pair$mcse_mean), c(4, 2, 4)), c(1.0905, 42.95, 0.0576), 0,
                 "toy-mcmc: pair R-hat 1.0905, bulk ESS 42.95, MCMC MCSE .0576")
expect_equal_num(round(tm$summary$pair$iid_sd_over_sqrt_draws, 5), 0.00835, 0, "toy-mcmc: iid formula .00835")
expect_equal_num(round(c(tm$summary$loss$mean, tm$summary$loss$mcse_mean), 4), c(0.2482, 0.0384), 0, "toy-mcmc: fixed-report loss mean .2482, MCSE .0384 (exact 4/15)")
expect_equal_num(mean(ifelse(as.vector(t(tm$arrays$trace$states)) == 1, tm$facts$fixed_report$loss_state1, tm$facts$fixed_report$loss_state0)),
                 tm$summary$loss$mean, 1e-12, "toy-mcmc: loss mean recomputed from the states and the per-state losses")
cat("24_export_toy_mcmc: done\n")
