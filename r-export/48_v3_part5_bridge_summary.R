# Author: JoonHo Lee (jlee296@ua.edu)
# Independent R-only summary of the approved exact tau-axis KRW grid.
# Scientific values use the frozen independently written R44 pure definitions.
# No old writer is executed; no frontend/TS/JS output or old golden is read.
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R')
assert_no_postrank()
write_json_stable <- function(x,path) {
  dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE)
  writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE)
  invisible(path)
}
extract <- function(path,names) {
  found <- character()
  for(expr in parse(path))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%names) {
    eval(expr,envir=.GlobalEnv);found<-c(found,as.character(expr[[2]]))
  }
  stopifnot(setequal(found,names))
}
extract('r-export/35_v3_part4.R',c('vec','%or%','Mof','lexsort','gl','earr','uncube','allreports','familyCache','familyreports'))
extract('r-export/44_v3_part5_krw.R',c('scalar','ksum','bridge','validFamily','familySize','validate','counts','countCache','reportData','correspondence'))
six <- jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE)
E <- six$arrays$one;taus <- (2:50)/100
stopifnot(length(E$ids)==6L,length(E$criteria)==1L,identical(unlist(E$criteria),'score_A'),
  length(taus)==49L,taus[1L]==.02,tail(taus,1L)==.5)
results <- lapply(taus,function(tau)correspondence(E,list(tau=tau,tieFree=TRUE)))
stopifnot(all(vapply(results,function(r)r$reportsEnumerated==4683L,TRUE)),
  all(vapply(results,function(r)!is.null(r$maxAffineResidual)&&is.finite(r$maxAffineResidual)&&r$maxAffineResidual>=0,TRUE)))
summary <- list(count=length(results),same=sum(vapply(results,`[[`,TRUE,'sameFullSet')),
  maxAffineResidual=max(vapply(results,`[[`,0,'maxAffineResidual')))
rows <- list(list(id='bridge-grid-summary',args=list(fn='caseBridgeGridSummary',data='six-sites',array='one',taus=vec(taus)),expect=summary))
assert_no_postrank()
write_golden('oracle-v3p5-bridge-summary',rows,'r-export/48_v3_part5_bridge_summary.R',uses_postrank=FALSE)
path <- file.path(golden_dir,'oracle-v3p5-bridge-summary.json')
manifest <- jsonlite::fromJSON(file.path(manifest_dir,'oracle-v3p5-bridge-summary.json'))
written <- jsonlite::fromJSON(path,simplifyVector=FALSE)
stopifnot(identical(manifest$sha256,sha256_file(path)),manifest$rows==1L,identical(manifest$uses_postrank,FALSE),
  identical(unname(unlist(written$rows[[1L]]$args$taus)),unname(taus)),
  identical(unname(unlist(written$rows[[1L]]$expect)),unname(unlist(summary))))
assert_no_postrank()
cat('oracle-v3p5-bridge-summary:1row; exact49tau-axis/all4683reports each;',summary$same,'of',summary$count,
  'same fullsets; max actual affine residual',format(summary$maxAffineResidual,digits=17),';17digit/checksum/independence PASS.\n')
