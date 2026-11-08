# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R seed-boundary UI pins for accepted Review A findings A-COR-001/A-CLR-001.
# Reproduce the seed and boundary cases for posterior report selection.
# mc-error app was not read. This generator loads neither postrank nor JavaScript/engine output.
# Run from the repository root: Rscript r-export/28_v3_review_a_seed_boundary.R
# Worktrees may set POSTRANK_SRC to the existing public source directory for _paths.R.
#
# Contract: S=100, score A, six released independent normal marginals, tau=.2, cap=3,
# pair A/B; 100 seeds wrap over 1..4294967295 while preserving the first seed.
# Expected draws use the separately implemented public stream in _rng.R (s-major, then unit).
# Error coefficients are sample means of weak-error indicators. Exact coefficients use pnorm.
# Trace MCSE = sample SD / sqrt(S); rerun spread = sample SD of the 100 estimated coefficients.
# Fragility is strict |min(ehat_AB,ehat_BA)-tau| < 2 MCSE; the within tally uses <= 2 shown MCSE.
# Pair actions use absolute cost tolerance 1e-12. Report ties use absolute normalized-risk
# tolerance 1e-12. Full canonical grade enumeration supplies all tied optima, without a solver.
# A report is kept when ANY tied empirical optimum is in the exact-law optimum set; together
# requires EVERY tied empirical optimum to withhold A/B. flipChanged/tieChanged classify the
# pair's action first and then count lack of exact-optimum membership in the capped family.
# flipChangedAll repeats that membership comparison in the all-report family on flipped runs.
# The IID envelope is the tie-free package form sqrt(log(2M/alpha)/(2S)), M=15, alpha=.05.
# These seeded teaching fixtures test numerical plumbing, not convergence/model calibration or
# independent randomness between arbitrary PRNG seeds. No generic MCMC or external-law claim.
source('r-export/_paths.R')
source('r-export/_helpers.R')
source('r-export/_oracle.R')
source('r-export/_rng.R')
assert_no_postrank()
vec <- function(x) I(unname(x))
U <- jsonlite::fromJSON(file.path(released_dir, 'six-sites.json'))$tables$units
means <- as.numeric(U$mean_A); sds <- as.numeric(U$sd_A); ids <- as.character(U$id)
n <- length(ids); M <- choose(n, 2); S <- 100L; runs <- 100L; tau <- .2; alpha <- .05
max_seed <- 4294967295; tie_tol <- 1e-12
stopifnot(n == 6L, identical(ids[1:2], c('A','B')))
ordered_pairs <- which(row(matrix(0,n,n)) != col(matrix(0,n,n)), arr.ind = TRUE)
exact <- matrix(NA_real_, n, n)
for (i in seq_len(n)) for (j in seq_len(n)) if (i != j)
  exact[i,j] <- pnorm((means[j]-means[i])/sqrt(sds[i]^2+sds[j]^2))
exact_vec <- exact[ordered_pairs]
radius <- sqrt(log(2*M/alpha)/(2*S))

# Rows represent distinct ordered partitions, sorted lexicographically. The incidence product
# independently sums the supplied directional coefficients, one disclosed unordered pair once.
G <- oracle_reports(n); G <- G[do.call(order, as.data.frame(G)),,drop=FALSE]
incidence <- vapply(seq_len(nrow(ordered_pairs)), function(k)
  as.numeric(G[,ordered_pairs[k,1]] < G[,ordered_pairs[k,2]]), numeric(nrow(G)))
N <- rowSums(incidence); cap_ix <- which(apply(G,1,max) <= 3L)
stopifnot(nrow(G) == 4683L, length(cap_ix) == 603L)
risks <- function(ev) (drop(incidence %*% ev) + tau*(M-N))/M
opt_indices <- function(r, ix) ix[r[ix] <= min(r[ix]) + tie_tol]
exact_risk <- risks(exact_vec)
exact_cap <- opt_indices(exact_risk,cap_ix); exact_all <- opt_indices(exact_risk,seq_len(nrow(G)))
action <- function(eab,eba) {cost <- c(eab,eba,tau); which(cost <= min(cost)+tie_tol)}
exact_choice <- action(exact[1,2],exact[2,1])

make_row <- function(id, first_seed) {
  seeds <- 1 + ((first_seed-1 + 0:(runs-1)) %% max_seed)
  stopifnot(seeds[1] == first_seed, length(unique(seeds)) == runs,
    all(seeds >= 1 & seeds <= max_seed))
  ehat <- mcse <- numeric(runs); kinds <- character(runs); held <- kept <- together <- logical(runs)
  all_kept <- logical(runs); ties <- integer(runs)
  for (r in seq_len(runs)) {
    z <- matrix(prx_normals(seeds[r],S*n), nrow=S, ncol=n, byrow=TRUE)
    draws <- sweep(sweep(z,2,sds,'*'),2,means,'+')
    eh <- matrix(NA_real_,n,n)
    for(i in seq_len(n))for(j in seq_len(n))if(i != j)eh[i,j] <- mean(draws[,i] <= draws[,j])
    trace <- as.numeric(draws[,1] <= draws[,2])
    ehat[r] <- mean(trace); mcse[r] <- stats::sd(trace)/sqrt(S)
    act <- action(eh[1,2],eh[2,1])
    kinds[r] <- if(identical(act,exact_choice)) 'same' else if(length(act)>1L) 'tie' else 'flip'
    held[r] <- max(abs(eh[ordered_pairs]-exact_vec)) <= radius
    rr <- risks(eh[ordered_pairs]); empirical <- opt_indices(rr,cap_ix)
    ties[r] <- length(empirical); kept[r] <- any(empirical %in% exact_cap)
    together[r] <- all(G[empirical,1] == G[empirical,2])
    if(kinds[r] == 'flip')all_kept[r] <- any(opt_indices(rr,seq_len(nrow(G))) %in% exact_all)
  }
  tied_sizes <- ties[ties > 1L]
  # Public JS enumeration returns at most 100 representatives; this fixture does not truncate.
  stopifnot(max(ties) <= 100L)
  # With this tie-free one-criterion law, reversing the Bernoulli trace preserves its MCSE.
  fragile <- abs(pmin(ehat,1-ehat)-tau) < 2*mcse
  expect <- list(
    seeds=vec(seeds),eHatAB=vec(ehat),acrossRunSd=stats::sd(ehat),shownMcse=mcse[1],
    withinCount=if(mcse[1] > 0)sum(abs(ehat-exact[1,2]) <= 2*mcse[1]) else NULL,
    fragileCount=sum(fragile),sameCount=sum(kinds=='same'),flipCount=sum(kinds=='flip'),
    tieCount=sum(kinds=='tie'),envelopeHeldCount=sum(held),
    reportKept=sum(kept),together=sum(together),flipChanged=sum(kinds=='flip' & !kept),
    tieChanged=sum(kinds=='tie' & !kept),tiedRuns=length(tied_sizes),
    tiedLo=if(length(tied_sizes))min(tied_sizes) else 0L,
    tiedHi=if(length(tied_sizes))max(tied_sizes) else 0L,
    flipChangedAll=sum(kinds=='flip' & !all_kept),
    distinctSeeds=length(unique(seeds)),seedFirst=seeds[1],seedLast=seeds[runs],
    exactEAB=exact[1,2],radius=radius)
  cat(id,': first',seeds[1],'last',seeds[runs],'; SD',expect$acrossRunSd,
    '; shown MCSE',expect$shownMcse,'; within/fragile/same/flip/tie/held',
    expect$withinCount,expect$fragileCount,expect$sameCount,expect$flipCount,
    expect$tieCount,expect$envelopeHeldCount,'\n')
  list(id=id,args=list(kind='mc-seed-boundary',firstSeed=first_seed,runs=runs,S=S,
    means=vec(means),sds=vec(sds),ids=vec(ids),tau=tau,cap=3L,pair=vec(c(0L,1L)),
    alpha=alpha,tieTol=tie_tol,maxSeed=max_seed),expect=expect)
}
rows <- list(make_row('mc-seed-max',max_seed),make_row('mc-seed-near-max',max_seed-49))
assert_no_postrank()
write_golden('oracle-v3-review-a',rows,'r-export/28_v3_review_a_seed_boundary.R',FALSE)
