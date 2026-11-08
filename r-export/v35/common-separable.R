# Author: JoonHo Lee (jlee296@ua.edu)
# Complete-law public-API oracles for Explorer v3.5 applications P.1 and P.2.
# Run from the repository root after the shared Step 3.1 helper is accepted:
#   R_LIBS_USER=/path/to/.R-library-v35 Rscript r-export/v35/common-separable.R
# Writes only new v3.5 goldens and its private execution receipt.
source("r-export/v35/_oracle.R")

v35_cs_values <- function(one, two) {
  list(c(as.integer(one[[1L]]), as.integer(two[[1L]])),
       c(as.integer(one[[2L]]), as.integer(two[[2L]])))
}
v35_cs_matrix <- function(values) {
  if (is.matrix(values)) return(values)
  do.call(rbind, lapply(values, function(x) as.integer(unlist(x, use.names=FALSE))))
}
v35_cs_chars <- function(x) unname(as.character(unlist(x, use.names=FALSE)))
v35_cs_same_set <- function(x, y) identical(sort(v35_cs_chars(x)), sort(v35_cs_chars(y)))
v35_cs_columns <- list(withhold=c(1L,1L), A_above_B=c(1L,2L), B_above_A=c(2L,1L))
v35_cs_targets <- function() lapply(c("one","two"), function(id) list(
  domainId=id, definition=paste("Fictional", id, "priority coordinate"),
  units="illustrative score", orientation="larger_is_higher",
  equalityClasses=c("A","B"),
  equalityProvenance="The model declares no shared target identity between A and B."))
v35_cs_family <- function() list(
  familyId="two-domain-three-column-product", unitIds=c("A","B"), domainIds=c("one","two"),
  maxGrades=c(2L,2L), maxActions=9L,
  banks=lapply(c("one","two"), function(id) list(domainId=id,
    columns=lapply(names(v35_cs_columns), function(k) list(columnId=k, grades=v35_cs_columns[[k]])))))
v35_cs_fixture <- function(id, law, rows_a, masses, tau, weights, guard=FALSE) {
  list(schemaVersion="postrank-explorer-mdomain-v1", fixtureId=id,
    description=paste("Independent public postrank 1.2.0 oracle for",id,
      "on a complete finite teaching law; every candidate is evaluated."),
    input=list(inputId=paste0(law,"-input"), lawId=law,
      representation="exact_finite_law", coupling="supplied_joint",
      unitIds=c("A","B"), domainIds=c("one","two"),
      stateIds=if (length(rows_a)==2L) c("usual","reversal") else c("++","-+","+-","--"),
      states=lapply(rows_a,function(x) list(as.numeric(x),c(0,0))), masses=masses,
      targets=v35_cs_targets(),
      provenance=list(producer="Self-contained fictional teaching law",
        conditioningInfo="Specified finite law, with no fitted observations.",
        jointGeneration="Each labelled state contains A and B in both domains together.",
        finiteSupportOrigin="The listed matrices exhaust this declared law, including any zero-mass rows.",
        properLaw=TRUE)),
    decision=list(decisionId=paste0(id,"-policy"), domainIds=c("one","two"),
      scope="all_pairs", weights=weights, tau=rep(tau,2L), q=NULL,
      t=if(guard) c("0","0") else NULL, alpha="3/20"), family=v35_cs_family())
}
v35_cs_evaluation_map <- function(result) {
  rows <- result$expected$fixedCards
  stopifnot(length(rows)==9L)
  setNames(lapply(rows, `[[`, "evaluation"), vapply(rows, `[[`, "", "cardId"))
}
v35_cs_projection_audit <- function(result) {
  fit <- result$expected$fit; rows <- fit$candidateTable
  stopifnot(length(rows)==9L)
  ids <- vapply(rows, `[[`, "", "candidateId")
  feasible <- vapply(rows, function(x) isTRUE(x$feasible), TRUE)
  column_key <- function(row,d) paste(v35_cs_matrix(row$grades$values)[,d],collapse=",")
  keys <- lapply(1:2,function(d) vapply(rows,column_key,"",d=d))
  projections <- lapply(keys,function(k) unique(k[feasible]))
  projected <- Reduce(`&`,Map(function(k,p) k %in% p, keys, projections))
  evals <- v35_cs_evaluation_map(result)
  domain_rows <- lapply(1:2, function(d) {
    columns <- projections[[d]]
    # Domain losses are exported from public fixed-card evaluations; no private R internals.
    losses <- vapply(columns,function(k) {
      candidate <- ids[match(k,keys[[d]])]
      evals[[candidate]]$domains[[d]]$weightedLossExact
    },"")
    unweighted <- vapply(columns,function(k) {
      candidate <- ids[match(k,keys[[d]])]
      evals[[candidate]]$domains[[d]]$lossExact
    },"")
    q <- gmp::as.bigq(losses); low <- min(q)
    list(domainId=result$input$domainIds[[d]], projectionColumns=as.list(columns),
      losses=lapply(seq_along(columns),function(j) list(column=columns[[j]],
        lossExact=unweighted[[j]], weightedLossExact=losses[[j]])),
      weightedMinimumExact=as.character(low),
      weightedArgminColumns=as.list(columns[as.logical(q==low)]))
  })
  args <- lapply(domain_rows,function(x) v35_cs_chars(x$weightedArgminColumns))
  argprod <- Reduce(`&`,Map(function(k,p) k %in% p,keys,args))
  total <- sum(gmp::as.bigq(vapply(domain_rows,`[[`,"","weightedMinimumExact")))
  factors <- identical(ids[feasible],ids[projected])
  same <- v35_cs_same_set(ids[argprod],fit$optimizerIds)
  if(factors) {
    stopifnot(same, as.character(total)==fit$riskExact)
  }
  list(fixtureId=result$fixtureId, feasibleCandidateIds=as.list(ids[feasible]),
    projectionProductIds=as.list(ids[projected]),
    feasibleFamilyFactors=factors, domainTables=domain_rows,
    sumProjectedWeightedMinimaExact=as.character(total),
    projectedArgminProductIds=as.list(ids[argprod]),
    allProjectedArgminsFeasible=all(feasible[argprod]),
    projectedArgminProductEqualsOptimizerSet=same,
    actualRiskExact=fit$riskExact, optimizerIds=fit$optimizerIds,
    selectedId=fit$selectedId)
}
v35_cs_assert_preset <- function(result, product_risk, product_count,
                                 common_risk=NULL, common_count=NULL) {
  fit <- result$expected$fit
  stopifnot(fit$riskExact==product_risk, length(fit$optimizerIds)==product_count)
  if(!is.null(common_risk)) {
    common <- result$expected$comparisons[[1L]]
    stopifnot(common$riskExact==common_risk,length(common$optimizerIds)==common_count)
  }
  invisible(TRUE)
}

out_dir <- "verification/golden/v35"
receipt_dir <- "verification/report/v35-oracle"
dir.create(out_dir,recursive=TRUE,showWarnings=FALSE)
dir.create(receipt_dir,recursive=TRUE,showWarnings=FALSE)
common_results <- list(); separable_results <- list(); projection_audits <- list(); paths <- character()
# All twelve reachable P.1 scientific settings, not only the four named presets.
for(pattern in c("aligned","crossed")) for(tau_name in c("low","boundary","ordinary")) for(w_name in c("equal","one-heavy")) {
  tau <- c(low="1/20",boundary="1/10",ordinary="1/4")[[tau_name]]
  weights <- if(w_name=="equal") c("1/2","1/2") else c("9/10","1/10")
  rows <- if(pattern=="aligned") list(c(1,1),c(-1,-1)) else list(c(1,-1),c(-1,1))
  id <- paste("common",pattern,tau_name,w_name,sep="-")
  fixture <- v35_cs_fixture(id,paste0("common-",pattern,"-law"),rows,c("9/10","1/10"),tau,weights,FALSE)
  result <- v35_oracle_fixture(fixture,generator="r-export/v35/common-separable.R",
    comparisons=list(list(comparisonId="common-diagonal",candidateIds=v35_common_candidate_ids(fixture))),
    fixed_cards="all")
  if(tau_name=="ordinary" && w_name=="equal" && pattern=="aligned") v35_cs_assert_preset(result,"1/10",1L,"1/10",1L)
  if(tau_name=="ordinary" && w_name=="equal" && pattern=="crossed") v35_cs_assert_preset(result,"1/10",1L,"1/4",1L)
  if(tau_name=="low" && w_name=="equal" && pattern=="crossed") v35_cs_assert_preset(result,"1/20",1L,"1/20",1L)
  if(tau_name=="ordinary" && w_name=="one-heavy" && pattern=="crossed") v35_cs_assert_preset(result,"1/10",1L,"9/50",1L)
  if(tau_name=="boundary" && w_name=="equal" && pattern=="crossed") v35_cs_assert_preset(result,"1/10",4L,"1/10",1L)
  file <- file.path(out_dir,paste0(id,".json"));v35_write_fixture(result,file)
  common_results[[id]] <- result;paths <- c(paths,file)
}
# All twelve P.2 combinations: three couplings, two weight settings, guard off/on.
for(coupling in c("disjoint","independent","coincident")) for(w_name in c("equal","one-zero")) for(guard in c(FALSE,TRUE)) {
  masses <- switch(coupling,disjoint=c("4/5","1/10","1/10","0"),
    independent=c("81/100","9/100","9/100","1/100"),coincident=c("9/10","0","0","1/10"))
  weights <- if(w_name=="equal") c("1/2","1/2") else c("0","1")
  id <- paste("separable",coupling,w_name,if(guard)"guard-on" else "guard-off",sep="-")
  fixture <- v35_cs_fixture(id,paste0("separable-",coupling,"-law"),
    list(c(1,1),c(-1,1),c(1,-1),c(-1,-1)),masses,"1/4",weights,guard)
  result <- v35_oracle_fixture(fixture,generator="r-export/v35/common-separable.R",fixed_cards="all")
  audit <- v35_cs_projection_audit(result)
  if(!guard && w_name=="equal") v35_cs_assert_preset(result,"1/10",1L)
  if(!guard && w_name=="one-zero") v35_cs_assert_preset(result,"1/10",3L)
  if(guard && coupling=="coincident" && w_name=="equal") v35_cs_assert_preset(result,"1/10",1L)
  if(guard && coupling=="coincident" && w_name=="one-zero") v35_cs_assert_preset(result,"1/10",2L)
  if(guard && coupling!="coincident" && w_name=="equal") v35_cs_assert_preset(result,"7/40",2L)
  if(guard && coupling!="coincident" && w_name=="one-zero") v35_cs_assert_preset(result,"1/10",1L)
  stopifnot(audit$feasibleFamilyFactors == (!guard || coupling=="coincident"))
  file <- file.path(out_dir,paste0(id,".json"));v35_write_fixture(result,file)
  separable_results[[id]] <- result;projection_audits[[id]] <- audit;paths <- c(paths,file)
}
stopifnot(length(common_results)==12L,length(separable_results)==12L)
receipt <- list(status="PASS",step="Step 3.2",generator="r-export/v35/common-separable.R",
  packageVersion=as.character(utils::packageVersion("postrank")),
  commonFixtures=length(common_results),separableFixtures=length(separable_results),
  candidateRows=24L*9L,fullFixedEvaluations=24L*9L,
  commonDiagonalComparisons=12L,projectionAudits=projection_audits,files=as.list(paths),
  scope="Complete finite teaching laws through the published R API; no browser result or private p2 helper is used.")
jsonlite::write_json(receipt,file.path(receipt_dir,"common-separable.json"),auto_unbox=TRUE,pretty=TRUE,null="null")
cat("PASS: common/separable public-API oracle; 24 fixtures, 216 candidate rows and fixed evaluations.\n")
