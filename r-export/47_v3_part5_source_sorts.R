# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R public v1 S02 display-order fixtures. Authority:
# js/widgets/case-krw-race.js keyOrder/blockOrder (lines362--378), published
# inventory S02/F10/F25/F33, and the explicit Phase8 R47 source-sort contract.
# No new frontend/TS code, JS output/execution, old golden expectations,
# postrank namespace, private input, optimizer, network, or browser is used.
source('r-export/_paths.R'); source('r-export/_helpers.R'); source('r-export/_oracle.R')
assert_no_postrank()
write_json_stable <- function(x,path) {
  dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE)
  writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE)
  invisible(path)
}
vec <- function(x)I(unname(x))
num <- function(x)as.numeric(unlist(x,use.names=FALSE))
read <- function(key)jsonlite::fromJSON(file.path(released_dir,paste0(key,'.json')),simplifyVector=FALSE)
krw <- read('case-krw');grid <- read('krw-lambda-grid')
ids <- unlist(krw$arrays$error$ids);n <- length(ids);input <- seq_len(n)
stopifnot(n==97L,identical(ids,unlist(krw$tables$units$id)),
  identical(ids,unlist(krw$tables$reports$id)),identical(ids,unlist(grid$tables$firms$id)),
  length(grid$facts$lambda)==101L,tail(num(grid$facts$lambda),1L)==1)
indices <- c(1L,8L,10L,25L,30L,50L,97L,98L,99L,100L)
rows <- list()
for(criterion in c('race','gender')) {
  mean <- num(krw$tables$units[[paste0('mean_',criterion)]])
  estimate <- num(krw$tables$units[[paste0(criterion,'_estimate')]])
  se <- num(krw$tables$units[[paste0(criterion,'_se')]])
  last <- num(tail(grid$arrays[[criterion]]$grade,1L)[[1L]])
  stopifnot(length(mean)==n,length(estimate)==n,length(se)==n,length(last)==n,
    all(is.finite(mean)),all(is.finite(estimate)),all(is.finite(se)))
  for(index in indices) {
    grade <- num(grid$arrays[[criterion]]$grade[[index+1L]])
    baseline <- order(grade,-mean,input,method='radix')
    baselinePosition <- match(input,baseline)-1L
    for(sort in c('mean','estimate','krw')) {
      # Sorting is lexicographic: current grade, source key, ORIGINAL INDEX.
      # KRW figure order is the supplied lambda1 grade, not expected rank.
      key <- switch(sort,mean=-mean,estimate=-estimate,krw=last)
      selected <- order(grade,key,input,method='radix')
      selectedPosition <- match(input,selected)-1L
      displacement <- selectedPosition-baselinePosition
      movedCount <- sum(displacement!=0L);maxAbsShift <- max(abs(displacement))
      # Retain every positive-max mover in selected-row order. This includes
      # either displacement sign; its first element matches the source's
      # first strict-maximum selection without discarding equal movers.
      most <- if(maxAbsShift>0L)selected[abs(displacement[selected])==maxAbsShift]else integer()
      details <- lapply(most,function(i)list(i=i-1L,id=ids[i],estimate=estimate[i],se=se[i],mean=mean[i]))
      stopifnot(identical(sort.int(selected),input),identical(sort.int(baseline),input),
        identical(selected[selectedPosition+1L],input),identical(baseline[baselinePosition+1L],input),
        identical(grade[selected],grade[baseline]),all(diff(grade[selected])>=0),sum(displacement)==0L,
        length(most)==sum(abs(displacement)==maxAbsShift & maxAbsShift>0L))
      if(sort=='mean')stopifnot(movedCount==0L,maxAbsShift==0L,length(most)==0L,all(displacement==0L))
      rows[[length(rows)+1L]] <- list(id=sprintf('krw-source-sort-%s-%03d-%s',criterion,index,sort),
        args=list(fn='caseKrwSourceSort',criterion=criterion,index=index,sort=sort),
        expect=list(selectedRows=vec(selected-1L),baselineRows=vec(baseline-1L),
          selectedPosition=vec(selectedPosition),baselinePosition=vec(baselinePosition),
          displacement=vec(displacement),movedCount=movedCount,maxAbsShift=maxAbsShift,
          mostMoved=vec(most-1L),mostMovedDetails=details))
    }
  }
}
stopifnot(length(rows)==60L,length(unique(vapply(rows,`[[`,'','id')))==60L)
assert_no_postrank()
write_golden('oracle-v3p5-source-sorts',rows,'r-export/47_v3_part5_source_sorts.R',uses_postrank=FALSE)
path <- file.path(golden_dir,'oracle-v3p5-source-sorts.json')
manifest <- jsonlite::fromJSON(file.path(manifest_dir,'oracle-v3p5-source-sorts.json'))
stopifnot(identical(manifest$sha256,sha256_file(path)),manifest$rows==60L,identical(manifest$uses_postrank,FALSE))
numbers <- function(x){if(is.list(x))return(unlist(lapply(x,numbers),use.names=FALSE));if(is.numeric(x))return(as.numeric(x[is.finite(x)]));numeric()}
written <- jsonlite::fromJSON(path,simplifyVector=FALSE)
stopifnot(identical(sort(numbers(rows)),sort(numbers(written$rows))))
assert_no_postrank()
cat('oracle-v3p5-source-sorts:60 rows;',length(numbers(rows)),
  'finite numbers exact17digit roundtrip; all3 actualsource sorts, permutations/positions/signeddisplacements/fullties PASS.\n')
