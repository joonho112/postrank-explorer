# Author: JoonHo Lee (jlee296@ua.edu).
# Independent exact view-level consequences of the frozen public-R candidate evaluations.
# Existing oracle inputs/results/manifests are read only; no browser result is imported.
source(file.path("r-export","v35","_oracle.R"))
manifest <- v35_read_fixture(file.path("verification","golden","v35","manifest.json"))
arr <- function(x) unname(as.list(x))
column_key <- function(row,d) paste(vapply(row$grades$values,function(v)as.integer(v[[d]]),integer(1)),collapse=",")
rows <- list()
for(entry in manifest$fixtures){
 id <- entry$fixtureId
 if(!grepl("^(common|separable)-",id))next
 f <- v35_read_fixture(entry$path);fit <- f$expected$fit;cards <- fit$candidateTable
 ids <- vapply(cards,`[[`,"","candidateId")
 if(grepl("^common-",id)){
  comparison <- f$expected$comparisons[[1L]]
  gap <- gmp::as.bigq(comparison$riskExact)-gmp::as.bigq(fit$riskExact)
  stopifnot(gap>=0)
  args <- list(kind="common",law=if(grepl("^common-aligned-",id))"aligned"else"crossed",tauIndex=as.integer(match(f$decision$tau[[1]],c("1/20","1/10","1/4"))-1L),weightIndex=as.integer(f$decision$weights[[1]]=="9/10"))
  expect <- list(commonRiskExact=comparison$riskExact,profileRiskExact=fit$riskExact,gapExact=as.character(gap),commonOptimizerIds=comparison$optimizerIds,profileOptimizerIds=fit$optimizerIds,commonSelectedId=comparison$selectedId,profileSelectedId=fit$selectedId,commonOptimizerCount=length(comparison$optimizerIds),profileOptimizerCount=length(fit$optimizerIds))
 }else{
  feasible <- vapply(cards,`[[`,FALSE,"feasible");F <- ids[feasible]
  keys <- lapply(1:2,function(d)vapply(cards,column_key,"",d=d))
  projections <- lapply(keys,function(k)unique(k[feasible]))
  projection_product <- ids[keys[[1]]%in%projections[[1]] & keys[[2]]%in%projections[[2]]]
  domain_min <- character(2);argmins <- list()
  for(d in 1:2){
   costs <- vapply(seq_along(cards),function(j)f$expected$fixedCards[[j]]$evaluation$domains[[d]]$weightedLossExact,"")
   for(key in unique(keys[[d]]))stopifnot(length(unique(costs[keys[[d]]==key]))==1L)
   one <- match(projections[[d]],keys[[d]]);q <- gmp::as.bigq(costs[one]);m <- min(q)
   domain_min[[d]] <- as.character(m);argmins[[d]] <- projections[[d]][q==m]
  }
  preferred <- ids[keys[[1]]%in%argmins[[1]] & keys[[2]]%in%argmins[[2]]]
  preferred_feasible <- preferred[preferred%in%F]
  bound <- sum(gmp::as.bigq(domain_min));gap <- gmp::as.bigq(fit$riskExact)-bound
  stopifnot(gap>=0,identical(gap==0,length(preferred_feasible)>0L))
  factorizes <- setequal(F,projection_product)
  if(factorizes)stopifnot(setequal(preferred,v35_chr(fit$optimizerIds)))
  args <- list(kind="separable",couplingIndex=as.integer(gmp::as.bigq(f$input$masses[[4L]])*100),zeroWeight=f$decision$weights[[1]]=="0",protected=!is.null(f$decision$t))
  expect <- list(feasibleIds=arr(F),projectionColumns=lapply(projections,arr),projectionProductIds=arr(projection_product),missingIds=arr(setdiff(projection_product,F)),factorizes=factorizes,projectionSizes=arr(vapply(projections,length,integer(1))),domainMinExact=arr(domain_min),weightedArgminColumns=lapply(argmins,arr),preferredIds=arr(preferred),preferredFeasibleIds=arr(preferred_feasible),boundExact=as.character(bound),actualRiskExact=fit$riskExact,gapExact=as.character(gap),lowerBoundAttained=length(preferred_feasible)>0L,preferredProductEqualsOptimizerSet=setequal(preferred,v35_chr(fit$optimizerIds)),optimizerIds=fit$optimizerIds,selectedId=fit$selectedId,feasibleCount=length(F),projectionProductCount=length(projection_product),preferredCount=length(preferred),preferredFeasibleCount=length(preferred_feasible),optimizerCount=length(fit$optimizerIds))
 }
 rows[[length(rows)+1L]] <- list(id=id,args=args,expect=expect)
}
stopifnot(length(rows)==24L)
body <- list(group="postrank-v35-profile-views",generator="r-export/v35/view-oracles.R",uses_postrank=TRUE,reference_package_version="1.2.0",source_commit=manifest$sourceCommit,origin="Exact gmp derivations from frozen independent public-R evaluations; no TypeScript values",rows=rows)
v35_write_fixture(body,file.path("verification","golden","postrank-v35-profile-views.json"))
cat("Wrote",length(rows),"independent R view-oracle rows\n")
