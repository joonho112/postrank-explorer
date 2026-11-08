# Portable complete finite-law oracle through postrank 1.2.0 public functions.
# Author: JoonHo Lee <jlee296@ua.edu>
# The returned JSON is a mathematical display fixture, never an R fitted object.
source(file.path(getwd(), "r-export", "v35", "_paths.R"), local=TRUE)
v35_environment <- v35_load_postrank()

v35_chr <- function(x) {
  value <- unlist(x, recursive=FALSE, use.names=FALSE)
  if (!length(value)) return(character())
  if (!is.character(value) || anyNA(value)) stop("Expected character values; no coercion is performed.", call.=FALSE)
  unname(value)
}
v35_num <- function(x) {
  value <- unlist(x, recursive=FALSE, use.names=FALSE)
  if (!length(value)) return(numeric())
  if (!is.numeric(value) || is.complex(value)) stop("Expected numeric values; no coercion is performed.", call.=FALSE)
  unname(as.numeric(value))
}
v35_arr <- function(x) unname(as.list(unname(x)))
v35_assert <- function(ok, message) if (!isTRUE(ok)) stop(message, call.=FALSE)
v35_exact <- function(x) as.character(gmp::as.bigq(as.character(x)))
v35_read_fixture <- function(path) jsonlite::read_json(path, simplifyVector=FALSE)
v35_write_fixture <- function(x, path) {
  dir.create(dirname(path), recursive=TRUE, showWarnings=FALSE)
  jsonlite::write_json(x, path, auto_unbox=TRUE, pretty=TRUE, digits=NA,
                      null="null", na="null")
  invisible(path)
}
v35_grade_matrix <- function(record) {
  units <- v35_chr(record$unitIds); domains <- v35_chr(record$domainIds)
  v35_assert(length(record$values)==length(units), "Grade row count differs from unit IDs.")
  G <- matrix(NA_real_, length(units), length(domains), dimnames=list(units,domains))
  for (i in seq_along(units)) {
    row <- v35_num(record$values[[i]])
    v35_assert(length(row)==length(domains), "Grade column count differs from domain IDs.")
    G[i,] <- row
  }
  G
}
v35_grade_record <- function(G) {
  list(unitIds=v35_arr(rownames(G)), domainIds=v35_arr(colnames(G)),
       values=unname(lapply(seq_len(nrow(G)), function(i) v35_arr(as.integer(G[i,])))))
}
v35_candidate_key <- function(grades) {
  if (!is.matrix(grades)) grades <- v35_grade_matrix(grades)
  paste0("p:", paste(vapply(seq_len(ncol(grades)), function(d)
    paste(as.integer(grades[,d]),collapse=","), ""), collapse="|"))
}
v35_assurance <- function(kind) list(arithmetic="exact_represented_finite_law",
  properLawStatus="producer_declaration", numericalGuarantee=FALSE,
  intendedPosteriorFeasibilityCertified=FALSE, searchOptimality=kind)

v35_bind_fixture <- function(fixture) {
  x <- fixture$input; d <- fixture$decision; f <- fixture$family
  v35_assert(identical(fixture$schemaVersion,"postrank-explorer-mdomain-v1"), "Unsupported fixture schema.")
  units <- v35_chr(x$unitIds); domains <- v35_chr(x$domainIds); states <- v35_chr(x$stateIds)
  n <- length(units); D <- length(domains); S <- length(states)
  v35_assert(n>=2L && n<=4L && D>=1L && D<=2L && S>=1L && S<=8L, "Browser teaching dimensions exceeded.")
  for (ids in list(units,domains,states)) v35_assert(!anyDuplicated(ids) && all(nzchar(trimws(ids))), "Duplicate or blank identifiers.")
  v35_assert(identical(x$representation,"exact_finite_law") && identical(x$coupling,"supplied_joint"), "Only complete supplied joint finite laws are supported.")
  v35_assert(identical(domains,v35_chr(d$domainIds)) && identical(domains,v35_chr(f$domainIds)) &&
    identical(units,v35_chr(f$unitIds)), "Input, decision and family IDs must agree in order.")
  v35_assert(identical(d$scope,"all_pairs"), "Only all-pair scopes are supported.")
  v35_assert(all(c("decisionId","domainIds","scope","weights","tau","q","t","alpha") %in% names(d)), "All policy fields, including explicit q/t nulls, are required.")
  v35_assert(length(x$states)==S && length(x$masses)==S && length(x$targets)==D && length(f$banks)==D, "Declared fixture dimensions differ.")
  values <- array(NA_real_,c(S,n,D),dimnames=list(states,units,domains))
  for (s in seq_len(S)) {
    v35_assert(length(x$states[[s]])==n, "State unit dimension differs.")
    for (i in seq_len(n)) {
      row <- v35_num(x$states[[s]][[i]])
      v35_assert(length(row)==D && all(is.finite(row)) && all(abs(row)<=2^53-1), "Invalid finite state values.")
      for (j in seq_len(D)) values[s,i,j] <- row[j]
    }
  }
  targets <- setNames(lapply(seq_len(D),function(j) {
    a <- x$targets[[j]]
    v35_assert(identical(a$domainId,domains[j]), "Target domain order differs.")
    classes <- v35_chr(a$equalityClasses)
    v35_assert(length(classes)==n, "Equality class count differs.")
    list(definition=a$definition, units=a$units, orientation=a$orientation,
      transformations=list(), equality_classes=setNames(classes,units),
      equality_provenance=a$equalityProvenance)
  }),domains)
  p <- x$provenance
  provenance <- list(input_id=x$inputId,law_id=x$lawId,proper_law=p$properLaw,
    producer=p$producer,conditioning_info=p$conditioningInfo,joint_generation=p$jointGeneration,
    sampling_assumptions=list(finite_support_origin=p$finiteSupportOrigin))
  input <- postrank::postrank_mdomain_input(values,targets=targets,provenance=provenance,
    representation="exact_finite_law",masses=v35_chr(x$masses),state_origin=NULL,equality_classes=NULL)
  vector <- function(z) {
    if (is.null(z)) return(NULL)
    value <- v35_chr(z)
    v35_assert(length(value)==D, "Policy vectors require one value per domain.")
    setNames(value,domains)
  }
  v35_assert(!is.null(d$weights) && !is.null(d$tau), "Weights and tau must be supplied explicitly.")
  decision <- postrank::postrank_mdomain_decision(weights=vector(d$weights),tau=vector(d$tau),
    scope="all_pairs",q=vector(d$q),t=vector(d$t),alpha=d$alpha,expected=NULL,joint=NULL)
  raw <- setNames(lapply(seq_len(D),function(j) {
    bank <- f$banks[[j]]
    v35_assert(identical(bank$domainId,domains[j]), "Candidate bank domain order differs.")
    v35_assert(length(bank$columns)<=256L,"Raw browser bank cap exceeded.")
    labels <- vapply(bank$columns,function(c) c$columnId,"")
    v35_assert(!anyDuplicated(labels),"Duplicate supplied column IDs.")
    setNames(lapply(bank$columns,function(c) {
      g <- v35_num(c$grades)
      v35_assert(length(g)==n && all(is.finite(g)) && all(g==floor(g)) && all(abs(g)<=2^53-1),"Invalid supplied grade column.")
      setNames(g,units)
    }),labels)
  }),domains)
  banks <- lapply(raw,function(columns) {
    canonical <- c(list(rep(1L,n)),lapply(columns,function(g) as.integer(match(g,sort(unique(g))))))
    keys <- vapply(canonical,paste,"",collapse=",")
    canonical <- canonical[!duplicated(keys)]
    a <- do.call(rbind,canonical)
    order <- do.call(base::order,c(lapply(seq_len(n),function(i) a[,i]),list(method="radix")))
    unname(lapply(order,function(i) as.integer(a[i,])))
  })
  counts <- vapply(banks,length,1L)
  size <- prod(gmp::as.bigz(counts)); limit <- v35_num(f$maxActions)
  v35_assert(length(limit)==1L && is.finite(limit) && limit==floor(limit) && limit>=1L && limit<=256L && size<=gmp::as.bigz(limit), "Browser product action cap exceeded before enumeration.")
  caps <- v35_num(f$maxGrades)
  v35_assert(length(caps)==D && all(caps>=1 & caps<=n & caps==floor(caps)),"Invalid domain grade caps.")
  family <- postrank::postrank_mdomain_family(input,columns=raw,order=NULL,cuts=NULL,
    max_grades=setNames(caps,domains),max_actions=limit)
  index <- as.matrix(expand.grid(lapply(counts,seq_len),KEEP.OUT.ATTRS=FALSE))
  sort <- do.call(base::order,c(lapply(seq_len(D),function(j) index[,j]),list(method="radix")))
  index <- index[sort,,drop=FALSE]
  matrices <- unname(lapply(seq_len(nrow(index)),function(k) {
    G <- matrix(0L,n,D,dimnames=list(units,domains))
    for (j in seq_len(D)) G[,j] <- banks[[j]][[index[k,j]]]
    G
  }))
  names(matrices) <- vapply(matrices,v35_candidate_key,"")
  list(input=input,decision=decision,family=family,matrices=matrices,
    fixture=fixture,values=values,units=units,domains=domains,states=states)
}
v35_candidate_matrices <- function(fixture) v35_bind_fixture(fixture)$matrices
v35_common_candidate_ids <- function(x) {
  fit <- if (!is.null(x$expected$fit)) x$expected$fit else if (!is.null(x$candidateTable)) x else NULL
  if (!is.null(fit)) {
    matrices <- lapply(fit$candidateTable,function(r) v35_grade_matrix(r$grades))
    names(matrices) <- vapply(fit$candidateTable,function(r) r$candidateId,"")
  } else matrices <- v35_candidate_matrices(x)
  names(matrices)[vapply(matrices,function(G) all(vapply(seq_len(ncol(G)),function(j) identical(G[,j],G[,1L]),TRUE)),TRUE)]
}

v35_evaluation <- function(bound,G) {
  card <- postrank::postrank_mdomain_evaluate(bound$input,G,decision=bound$decision,
    mode="joint",keep_traces=TRUE)
  G <- postrank::postrank_mdomain_grades(card)
  x <- bound$fixture$input; d <- bound$fixture$decision
  D <- length(bound$domains); S <- length(bound$states); n <- length(bound$units)
  # Derive portable state counts independently from the declared values and the
  # public verified grade matrix; no native R trace schema is exported or required.
  F <- matrix(0L,S,D); hits <- matrix(FALSE,S,D)
  for (s in seq_len(S)) for (j in seq_len(D)) for (i in seq_len(n-1L)) for (k in seq.int(i+1L,n)) {
    if (G[i,j]<G[k,j] && bound$values[s,i,j]<=bound$values[s,k,j]) F[s,j] <- F[s,j]+1L
    if (G[i,j]>G[k,j] && bound$values[s,k,j]<=bound$values[s,i,j]) F[s,j] <- F[s,j]+1L
  }
  weights <- gmp::as.bigq(v35_chr(x$masses))
  rows <- unname(lapply(seq_len(D),function(j) {
    id <- bound$domains[j]; a <- card$domain_table[card$domain_table$domain_id==id,,drop=FALSE]
    mean <- card$expected_constraints[card$expected_constraints$domain_id==id,,drop=FALSE]
    event <- card$event_table[card$event_table$domain_id==id,,drop=FALSE]
    v35_assert(nrow(a)==1L && nrow(mean)<=1L && nrow(event)<=1L,"All-pair public result row mismatch.")
    v35_assert(identical(v35_exact(sum(weights*F[,j])),v35_exact(a$EF_exact)),"Public expected false count differs from direct state count.")
    if (nrow(event)) {
      cutoff <- as.integer(event$cutoff_exact)
      active <- !event$analytically_inactive[1L]
      if (active) hits[,j] <<- F[,j]>=cutoff
      v35_assert(identical(v35_exact(sum(weights*as.integer(hits[,j]))),v35_exact(event$p_exact)),"Public event probability differs from direct state count.")
    } else { cutoff <- NULL; active <- FALSE }
    list(domainId=id,gradeCount=as.integer(max(G[,j])),disclosedPairs=as.integer(a$N),
      withheldPairs=as.integer(a$withheld),expectedFalseCountExact=v35_exact(a$EF_exact),
      expectedFalseProportionExact=if (is.na(a$eFDP_exact)) NULL else v35_exact(a$eFDP_exact),
      lossExact=v35_exact(a$loss_exact),weightedLossExact=v35_exact(a$weighted_loss_exact),
      meanGuardSatisfied=if (nrow(mean)) isTRUE(mean$satisfied[1L]) else NULL,
      thresholdExact=if (nrow(event)) v35_exact(event$t_exact) else NULL,
      firstExceedanceCount=cutoff,eventProbabilityExact=if(nrow(event)) v35_exact(event$p_exact) else NULL,
      eventActive=isTRUE(active))
  }))
  union <- rowSums(hits)>0L
  v35_assert(identical(v35_exact(sum(weights*as.integer(union))),v35_exact(card$J_exact)),"Public union probability differs from same-state direct count.")
  list(inputId=x$inputId,lawId=x$lawId,decisionId=d$decisionId,grades=v35_grade_record(G),
    originalPairs=as.integer(card$M),riskExact=v35_exact(card$risk_exact),
    jointProbabilityExact=v35_exact(card$J_exact),meanFeasible=isTRUE(card$mean_feasible),
    jointFeasible=isTRUE(card$joint_feasible),feasible=isTRUE(card$feasible_for_represented_measure),
    jointStatus=card$status$joint,domains=rows,
    states=unname(lapply(seq_len(S),function(s) list(stateId=bound$states[s],falseCounts=v35_arr(as.integer(F[s,])),
      exceedances=v35_arr(as.logical(hits[s,])),unionExceeded=isTRUE(union[s])))),
    assurance=v35_assurance("fixed_card"))
}

v35_oracle_fixture <- function(fixture,generator,comparisons=list(),fixed_cards=list()) {
  v35_assert(is.character(generator) && length(generator)==1L && nzchar(generator),"Declare the exporter path.")
  bound <- v35_bind_fixture(fixture); matrices <- bound$matrices
  evaluations <- lapply(matrices,function(G) v35_evaluation(bound,G))
  rows <- unname(lapply(seq_along(matrices),function(k) {
    ev <- evaluations[[k]]
    list(candidateId=names(matrices)[k],grades=ev$grades,riskExact=ev$riskExact,
      jointProbabilityExact=ev$jointProbabilityExact,meanFeasible=ev$meanFeasible,
      jointFeasible=ev$jointFeasible,feasible=ev$feasible,
      disclosedCounts=unname(lapply(ev$domains,function(a) a$disclosedPairs)),
      gradeCounts=unname(lapply(ev$domains,function(a) a$gradeCount)),optimal=FALSE,selected=FALSE)
  }))
  feasible <- which(vapply(rows,function(r) r$feasible,TRUE))
  v35_assert(length(feasible)>0L,"All-withheld must preserve feasibility.")
  score <- gmp::as.bigq(vapply(rows[feasible],function(r) r$riskExact,""))
  optimizers <- feasible[as.logical(score==min(score))]; selected <- optimizers[1L]
  for (k in optimizers) rows[[k]]$optimal <- TRUE
  rows[[selected]]$selected <- TRUE
  solved <- postrank::postrank_mdomain_solve(bound$input,bound$family,decision=bound$decision,
    max_actions=as.integer(fixture$family$maxActions))
  selected_G <- postrank::postrank_mdomain_grades(solved)
  v35_assert(identical(v35_candidate_key(selected_G),rows[[selected]]$candidateId),"Public solver canonical selected card differs from exhaustive fixed-card oracle.")
  v35_assert(identical(as.integer(solved$optimizer_count),as.integer(length(optimizers))),"Public solver optimizer count differs.")
  table <- solved$candidate_table
  v35_assert(nrow(table)==length(rows) && identical(unname(as.character(table$risk_exact)),vapply(rows,function(r) r$riskExact,"")) &&
    identical(unname(as.character(table$J_exact)),vapply(rows,function(r) r$jointProbabilityExact,"")) &&
    identical(unname(table$feasible_for_represented_measure),vapply(rows,function(r) r$feasible,TRUE)) &&
    identical(unname(table$optimal),vapply(rows,function(r) r$optimal,TRUE)) &&
    identical(unname(table$selected),vapply(rows,function(r) r$selected,TRUE)),"Public solver candidate table differs from exhaustive fixed-card evaluation.")
  ev <- evaluations[[selected]]
  fit <- list(inputId=fixture$input$inputId,lawId=fixture$input$lawId,decisionId=fixture$decision$decisionId,
    familyId=fixture$family$familyId,candidateTable=rows,
    optimizerIds=v35_arr(vapply(rows[optimizers],function(r) r$candidateId,"")),
    selectedId=rows[[selected]]$candidateId,selectedGrades=ev$grades,riskExact=ev$riskExact,
    jointProbabilityExact=ev$jointProbabilityExact,
    searchScope=list(type="declared_cartesian_product",candidateCount=length(rows),examinedActions=length(rows),
      fullProductExamined=TRUE,unrestrictedOptimalityClaim=FALSE),assurance=v35_assurance("candidate_restricted"))
  expected <- list(fit=fit,selectedEvaluation=ev)
  if (is.character(fixed_cards) && identical(fixed_cards,"all")) {
    expected$fixedCards <- unname(lapply(seq_along(evaluations),function(k)
      list(cardId=names(matrices)[k],evaluation=evaluations[[k]])))
  } else if (length(fixed_cards)) {
    expected$fixedCards <- unname(lapply(fixed_cards,function(a) {
      v35_assert(is.character(a$cardId) && length(a$cardId)==1L,"Declare a fixed-card ID.")
      list(cardId=a$cardId,evaluation=v35_evaluation(bound,v35_grade_matrix(a$grades)))
    }))
  }
  if (length(comparisons)) expected$comparisons <- unname(lapply(comparisons,function(a) {
    ids <- v35_chr(a$candidateIds)
    v35_assert(length(ids)>0L && !anyDuplicated(ids) && all(ids %in% names(matrices)),"Comparison IDs must be a nonempty subset of the declared candidates.")
    indices <- which(names(matrices) %in% ids)
    eligible <- indices[vapply(rows[indices],function(r) r$feasible,TRUE)]
    v35_assert(length(eligible)>0L,"Comparison has no feasible candidate.")
    values <- gmp::as.bigq(vapply(rows[eligible],function(r) r$riskExact,""))
    best <- eligible[as.logical(values==min(values))]
    list(comparisonId=a$comparisonId,scope="listed_subset",candidateIds=v35_arr(names(matrices)[indices]),
      optimizerIds=v35_arr(names(matrices)[best]),selectedId=names(matrices)[best[1L]],riskExact=rows[[best[1L]]]$riskExact)
  }))
  fixture$expected <- expected
  fixture$oracle <- list(package="postrank",packageVersion="1.2.0",sourceCommit=v35_environment$sourceCommit,
    generator=generator,method="public_api_exhaustive_fixed_cards")
  fixture
}
