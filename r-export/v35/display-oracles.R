# Author: JoonHo Lee (jlee296@ua.edu).
# Frozen illustration audit only. No posterior states, risk recomputation or solver is used.
source(file.path("r-export","v35","_oracle.R"))
asset_path <- system.file("extdata","mdomain","synthetic40-card.json",package="postrank")
if(!nzchar(asset_path))stop("Public postrank 1.2.0 display asset missing")
asset <- v35_read_fixture(asset_path);rows <- list();arr <- function(x)unname(as.list(x))
for(k in seq_along(asset$cases)){
 case <- asset$cases[[k]];scenario <- if(k==1L)"primary"else"wide";prefix <- if(k==1L)"primary_"else"wide_"
 ids <- vapply(asset$grades,`[[`,"","unit_id")
 G <- cbind(vapply(asset$grades,function(x)as.integer(x[[paste0(prefix,"S")]]),integer(1)),vapply(asset$grades,function(x)as.integer(x[[paste0(prefix,"C")]]),integer(1)))
 nr <- max(G[,2]);nc <- max(G[,1]);cells <- list();occupancy <- matrix(0L,nr,nc)
 for(r in seq_len(nr))for(c in seq_len(nc)){
  members <- ids[G[,1]==c & G[,2]==r];occupancy[r,c] <- length(members)
  cells[[length(cells)+1L]] <- list(rowGrade=r,columnGrade=c,count=length(members),members=arr(members))
 }
 pairs <- list();classes <- c(neither=0L,first_only=0L,second_only=0L,same_direction=0L,crossed=0L)
 for(i in seq_len(nrow(G)-1L))for(j in seq.int(i+1L,nrow(G))){
  directions <- as.integer(sign(G[j,]-G[i,]));kind <- if(all(directions==0))"neither"else if(directions[[1L]]==0L)"second_only"else if(directions[[2L]]==0L)"first_only"else if(directions[[1L]]==directions[[2L]])"same_direction"else"crossed"
  classes[[kind]] <- classes[[kind]]+1L
  pairs[[length(pairs)+1L]] <- list(pairId=as.character(jsonlite::toJSON(c(ids[[i]],ids[[j]]),auto_unbox=FALSE)),unitA=ids[[i]],unitB=ids[[j]],directions=arr(directions),classification=kind)
 }
 N <- c(sum(vapply(pairs,function(x)x$directions[[1L]]!=0L,FALSE)),sum(vapply(pairs,function(x)x$directions[[2L]]!=0L,FALSE)))
 stopifnot(length(pairs)==780L,N[[1L]]==case$N_S,N[[2L]]==case$N_C)
 cuts <- vapply(N,function(n)as.integer(floor(gmp::as.bigq(case$t)*n)+1L),integer(1))
 denominators <- lapply(seq_len(2),function(d)list(domainId=c("S","C")[[d]],N=N[[d]],ratioStatus=if(N[[d]]==0L)"no_disclosure"else"not_stored",cutoff=cuts[[d]],eventActive=N[[d]]>0L&&cuts[[d]]<=N[[d]]))
 roles <- lapply(c("selection","diagnostic"),function(role)list(role=role,chainIds=asset$original_source[[paste0(role,"_chain_ids")]],stateCount=asset$original_source$states_per_role,storedRiskExact=if(role=="selection")case$risk_exact else case$diagnostic_risk_exact,storedJExact=case[[paste0(role,"_J_exact")]],storedUnionHits=case[[paste0(role,"_union_hits")]],storedAnyErrorHits=case[[paste0(role,"_any_error_hits")]]))
 derived <- list(occupancy_rows_C_columns_S=lapply(seq_len(nr),function(r)arr(occupancy[r,])),pair_class_counts=list(neither=unname(classes[["neither"]]),C_only=unname(classes[["second_only"]]),S_only=unname(classes[["first_only"]]),same=unname(classes[["same_direction"]]),crossed=unname(classes[["crossed"]])),unique_disclosed_pairs=length(pairs)-unname(classes[["neither"]]),crossed_pairs=unname(classes[["crossed"]]),occupied_cells=sum(occupancy>0L),total_cells=length(occupancy))
 expect <- list(grades=list(unitIds=arr(ids),domainIds=list("S","C"),values=lapply(seq_len(nrow(G)),function(i)arr(G[i,]))),cells=cells,pairs=pairs,counts=list(originalPairs=length(pairs),N_S=N[[1L]],N_C=N[[2L]]),derived=derived,denominators=denominators,roleRows=roles)
 rows[[length(rows)+1L]] <- list(id=paste0("fictional-",scenario),args=list(scenario=scenario),expect=expect)
}
body <- list(group="postrank-v35-fictional-display",generator="r-export/v35/display-oracles.R",uses_postrank=TRUE,reference_package_version="1.2.0",source_commit=v35_environment$sourceCommit,origin="Public bundled synthetic40 display asset; exact tuple counts and preserved stored fields only. No posterior calculation.",rows=rows)
v35_write_fixture(body,file.path("verification","golden","postrank-v35-fictional-display.json"))
cat("PASS two cards, 80 tuples and 1560 independently classified pairs; no model rerun\n")
