# Author: JoonHo Lee (jlee296@ua.edu)
# Independent fixed-report accounting for Part4 withholding diagnostics.
# Run from the repository root: Rscript r-export/42_v3_part4_withholding.R
# No new app/TypeScript/tests, postrank namespace, browser, network, timing,
# solver or large-family enumeration is used. Large-case grade vectors are
# frozen independently computed R35 INPUTS; all new profiles/deltas are R math.
source('r-export/_paths.R')
source('r-export/_helpers.R')
source('r-export/_oracle.R')
assert_no_postrank()
write_json_stable <- function(x,path) {
  dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE)
  writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE)
  invisible(path)
}

# Evaluate only the frozen PURE definitions, never R35's cases/data/writer.
pureNames <- c('vec','%or%','Mof','close','lexsort','gl','earr','uncube','from_released',
  'weights','evaluate','change','allreports','familyCache','familyreports','optimum',
  'finite','decadd','decsum','countjson','normal_pairs','orderdp','constrained','compare')
found <- character()
for(expr in parse('r-export/35_v3_part4.R')) {
  if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pureNames) {
    eval(expr); found <- c(found,as.character(expr[[2]]))
  }
}
stopifnot(setequal(found,pureNames)); assert_no_postrank()

# The original R35 manifest remains an integrity check, not a new expectation
# producer. Only its fixed grade inputs/options are reused for the large cases.
r35Path <- file.path(golden_dir,'oracle-v3p4.json')
r35Manifest <- jsonlite::fromJSON(file.path(manifest_dir,'oracle-v3p4.json'))
stopifnot(identical(sha256_file(r35Path),r35Manifest$sha256))
r35 <- jsonlite::fromJSON(r35Path,simplifyVector=FALSE)
stopifnot(identical(r35$group,'oracle-v3p4'),identical(r35$uses_postrank,FALSE))
frozen <- setNames(r35$rows,vapply(r35$rows,`[[`,'','id'))

rows <- list(); coverage <- list(); frozenInputs <- list()
add <- function(id,fn,args,expect) {
  stopifnot(!id %in% vapply(rows,`[[`,'','id'))
  rows[[length(rows)+1L]] <<- list(id=id,args=c(list(fn=fn),args),expect=expect)
}
plainGrade <- function(g) as.numeric(unlist(g,use.names=FALSE))
plainFamily <- function(f) {
  if(!is.null(f$order))f$order <- vec(plainGrade(f$order))
  if(!is.null(f$blocks))f$blocks <- vec(plainGrade(f$blocks))
  f
}
validGrade <- function(g,n,f,stating=list()) {
  g <- plainGrade(g)
  stopifnot(length(g)==n,all(is.finite(g)),all(g==as.integer(g)),
    identical(sort(unique(g)),as.numeric(seq_len(max(g)))))
  if(f$kind=='atMost')stopifnot(max(g)<=f$G)
  if(f$kind=='exactly')stopifnot(max(g)==f$G)
  if(f$kind=='order') {
    order <- plainGrade(f$order)+1L
    stopifnot(length(order)==n,identical(sort(order),as.numeric(seq_len(n))),all(diff(g[order])>=0))
    if(!is.null(f$G))stopifnot(max(g)<=f$G)
    if(!is.null(f$exact))stopifnot(max(g)==f$exact)
    if(!is.null(f$blocks)) {
      blocks <- plainGrade(f$blocks); stopifnot(sum(blocks)==n)
      starts <- c(1L,head(cumsum(blocks),-1L)+1L)
      for(b in seq_along(blocks))stopifnot(length(unique(g[order[starts[b]:(starts[b]+blocks[b]-1L)]]))==1L)
    }
  }
  for(pair in stating){pair<-plainGrade(pair)+1L;stopifnot(length(pair)==2L,g[pair[1]]<g[pair[2]])}
  invisible(g)
}
checkEvaluation <- function(g,E,tau,w,old=NULL) {
  ev <- evaluate(plainGrade(g),uncube(E),tau,as.numeric(w))
  stopifnot(ev$M==Mof(length(E$ids)),ev$N>=0,ev$N<=ev$M)
  if(ev$N==0)stopifnot(all(vapply(ev$EoverN,is.null,TRUE)),all(ev$E==0))
  if(!is.null(old)){close(ev$risk,as.numeric(old$risk));stopifnot(ev$N==as.numeric(old$N))}
  ev
}

# This gate makes accidental CDE-cap3/KRW enumeration impossible here.
smallConstrained <- function(E,tau,w,f,stating=list()) {
  n <- length(E$ids)
  stopifnot(n<=6L || (n==12L&&f$kind=='atMost'&&identical(as.integer(f$G),2L)))
  ans <- constrained(uncube(E),tau,as.numeric(w),f,stating)
  if(!ans$empty) {
    validGrade(ans$grade,n,f,stating)
    for(g in ans$grades){validGrade(g,n,f,stating);close(checkEvaluation(g,E,tau,w)$risk,ans$risk)}
    stopifnot(length(ans$grades)==as.numeric(ans$tieCount))
  }
  ans
}
compareFixed <- function(id,g0,g1,E,tau,w) {
  # Stripping AsIs from each fixed INPUT prevents scalar relation codes from
  # being serialized as one-element arrays; the mathematical vectors stay same.
  g0 <- plainGrade(g0); g1 <- plainGrade(g1)
  ans <- compare(g0,g1,uncube(E),tau,as.numeric(w))
  close(sum(vapply(ans$pairs,function(p)p$normalizedDifference,0)),ans$deltaRisk)
  close(ans$errorTermDelta+ans$withholdingTermDelta,ans$deltaRisk)
  stopifnot(length(ans$pairs)==ans$change$changed)
  add(id,'compareReports',list(g0=vec(g0),g1=vec(g1),E=E,
    options=list(tau=tau,w=vec(as.numeric(w)))),ans)
  invisible(ans)
}
compareTies <- function(id,base,target,E,tau,w) {
  if(target$empty)return(invisible(NULL))
  for(j in seq_along(target$grades))compareFixed(paste0(id,'-tie',j),base$grade,target$grades[[j]],E,tau,w)
}
directions <- function(forwardName,ij,reverseName=rev(strsplit(forwardName,'',fixed=TRUE)[[1]])) {
  # Pair labels are explicitly supplied below; no numerical result is encoded.
  list(list(label=paste0('forward-',forwardName),pair=vec(ij)),
    list(label=paste0('reverse-',paste(rev(strsplit(forwardName,'',fixed=TRUE)[[1]]),collapse='')),pair=vec(rev(ij))))
}
scenario <- function(id,E,tau,w,f,pairs) {
  f <- plainFamily(f); w <- as.numeric(w)
  base <- smallConstrained(E,tau,w,f)
  add(paste0('withholding-constrained-',id,'-base'),'pairConstrainedOptimum',
    list(E=E,options=list(tau=tau,w=vec(w),family=f,stating=list())),base)
  stopifnot(!base$empty,base$containsAllWithheld,base$risk<=tau+1e-12)
  identity <- compareFixed(paste0('withholding-compare-',id,'-identity'),base$grade,base$grade,E,tau,w)
  stopifnot(identity$deltaRisk==0,identity$change$changed==0L)
  if(length(base$grades)>1L)compareTies(paste0('withholding-compare-',id,'-base-alternatives'),base,base,E,tau,w)
  targets <- list()
  for(d in pairs) {
    stating <- list(d$pair); ans <- smallConstrained(E,tau,w,f,stating)
    add(paste0('withholding-constrained-',id,'-',d$label),'pairConstrainedOptimum',
      list(E=E,options=list(tau=tau,w=vec(w),family=f,stating=stating)),ans)
    if(!ans$empty) {
      stopifnot(ans$risk>=base$risk-1e-12)
      compareTies(paste0('withholding-compare-',id,'-to-',d$label),base,ans,E,tau,w)
    }
    targets[[d$label]] <- ans
  }
  coverage[[id]] <<- list(route='fresh small R35 constrained math',baseN=base$N,
    baseRisk=base$risk,baseTies=base$tieCount,targets=lapply(targets,function(o)list(empty=o$empty,tieCount=o$tieCount %or% NULL)))
  cat(id,': baseline N',base$N,'risk',format(base$risk,digits=17),'; full target ties',
    paste(vapply(targets,function(o)if(o$empty)'empty'else as.character(o$tieCount),''),collapse=','),'\n')
  list(id=id,E=E,tau=tau,w=w,family=f,base=base,targets=targets)
}
relaxation <- function(id,from,to) {
  stopifnot(identical(as.character(from$E$ids),as.character(to$E$ids)),
    identical(as.character(from$E$criteria),as.character(to$E$criteria)),from$tau==to$tau,
    identical(as.numeric(from$w),as.numeric(to$w)))
  close(as.vector(uncube(from$E)),as.vector(uncube(to$E)))
  compareTies(paste0('withholding-compare-',id,'-to-base'),from$base,to$base,to$E,to$tau,to$w)
  for(label in names(to$targets))compareTies(paste0('withholding-compare-',id,'-to-',label),from$base,to$targets[[label]],to$E,to$tau,to$w)
}

six <- jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE)
E6 <- from_released(six$arrays$two)
ab <- directions('ab',c(0L,1L)); ad <- directions('ad',c(0L,3L))
sixAll <- scenario('six-all',E6,.2,c(.5,.5),list(kind='all'),c(ab,ad))
sixCap <- scenario('six-cap3',E6,.2,c(.5,.5),list(kind='atMost',G=3L),c(ab,ad))
relaxation('six-cap3-relax-all',sixCap,sixAll)

# Whole joint states from the frozen chapter19 contract, restated independently.
criteria2 <- c('criterion 1','criterion 2')
chapterStates <- list(rbind(c(4,4),c(3,2),c(2,3),c(1,1)),
  rbind(c(3,1),c(4,2),c(2,3),c(1,4)))
E19 <- finite(chapterStates,c(.75,.25),c('A','B','C','D'),criteria2)
E19$pi <- E19$t <- NULL
bc <- directions('bc',c(1L,2L))
chapter <- scenario('chapter19-all',E19,.2,c(.6,.4),list(kind='all'),bc)
stopifnot(all(uncube(E19)[2,3,]==c(0,1)),all(uncube(E19)[3,2,]==c(1,0)))

# Both criteria agree inside each state, while the direction remains uncertain.
uncertainStates <- list(rbind(c(1,1),c(0,0)),rbind(c(-1,-1),c(0,0)))
EU <- finite(uncertainStates,c(.6,.4),c('A','B'),criteria2); EU$pi <- EU$t <- NULL
uncertain <- scenario('uncertain-all',EU,.2,c(.5,.5),list(kind='all'),ab)
stopifnot(uncertain$base$N==0L,all(uncube(EU)[1,2,]==.4),all(uncube(EU)[2,1,]==.6))

# Fixed order and indivisible block are separate declared base-family inputs.
orderStates <- list(rbind(c(20,20),c(4,4),c(3,3)),rbind(c(0,0),c(4,4),c(3,3)))
EO <- finite(orderStates,c(.3,.7),c('A','B','C'),criteria2); EO$pi <- EO$t <- NULL
blocked <- scenario('order-three-blocked',EO,.25,c(.5,.5),
  list(kind='order',order=vec(0:2),blocks=vec(c(1L,2L))),bc)
ordered <- scenario('order-three-order',EO,.25,c(.5,.5),list(kind='order',order=vec(0:2)),bc)
unrestrictedSmall <- scenario('order-three-all',EO,.25,c(.5,.5),list(kind='all'),bc)
stopifnot(blocked$targets[['forward-bc']]$empty,blocked$targets[['reverse-cb']]$empty,
  ordered$targets[['reverse-cb']]$empty,blocked$base$N==0L,ordered$base$N==0L)
relaxation('order-three-blocked-relax-order',blocked,ordered)
relaxation('order-three-order-relax-all',ordered,unrestrictedSmall)
relaxation('order-three-blocked-relax-all',blocked,unrestrictedSmall)

# Frozen CDE-cap3/KRW argmin vectors are declared FIXED REPORT INPUTS only.
# New expected profiles and comparison accounts below are always recomputed.
frozenResult <- function(rowId,E,tau,w,f,stating=list()) {
  r <- frozen[[rowId]]; stopifnot(!is.null(r),r$args$fn=='pairConstrainedOptimum',
    as.numeric(r$args$options$tau)==tau)
  declaredF <- plainFamily(r$args$options$family %or% list(kind='all'))
  stopifnot(identical(declaredF,f))
  if(!is.null(r$args$E))close(as.vector(uncube(r$args$E)),as.vector(uncube(E)))
  old <- r$expect
  if(old$empty)return(list(empty=TRUE,sourceRowId=rowId))
  g <- plainGrade(old$grade); gg <- lapply(old$grades,plainGrade)
  validGrade(g,length(E$ids),f,stating)
  ev <- checkEvaluation(g,E,tau,w,old)
  for(target in gg){validGrade(target,length(E$ids),f,stating);close(checkEvaluation(target,E,tau,w)$risk,ev$risk)}
  stopifnot(length(gg)==as.numeric(old$tieCount))
  frozenInputs[[rowId]] <<- list(grade=vec(g),retainedGrades=lapply(gg,vec),
    sourceFamilySize=old$familySize,sourceBaseSize=old$baseSize,sourceN=old$N,sourceRisk=old$risk)
  list(empty=FALSE,grade=vec(g),grades=lapply(gg,vec),tieCount=old$tieCount,
    N=ev$N,risk=ev$risk,sourceRowId=rowId)
}
frozenScenario <- function(id,E,tau,w,f,baseId,targetIds,pairs) {
  base <- frozenResult(baseId,E,tau,w,f)
  compareFixed(paste0('withholding-compare-',id,'-identity'),base$grade,base$grade,E,tau,w)
  targets <- list()
  for(i in seq_along(targetIds)) {
    label <- pairs[[i]]$label; stating <- list(pairs[[i]]$pair)
    target <- frozenResult(targetIds[[i]],E,tau,w,f,stating)
    if(!target$empty){stopifnot(target$risk>=base$risk-1e-12);compareTies(paste0('withholding-compare-',id,'-to-',label),base,target,E,tau,w)}
    targets[[label]] <- target
  }
  coverage[[id]] <<- list(route='frozen R35 grade inputs; fresh fixed-report accounts',baseRow=baseId,targetRows=targetIds)
  cat(id,': frozen vectors checked, fresh baseline N',base$N,'risk',format(base$risk,digits=17),'\n')
  list(id=id,E=E,tau=tau,w=w,family=f,base=base,targets=targets)
}

cde <- jsonlite::fromJSON(file.path(released_dir,'case-cde.json'),simplifyVector=FALSE)
EC <- from_released(cde$arrays$error); stopifnot(length(EC$ids)==12L,length(EC$criteria)==1L)
fi <- directions('fi',c(5L,8L))
cdeCap2 <- scenario('cde12-cap2',EC,.25,1,list(kind='atMost',G=2L),fi)
cdeCap3 <- frozenScenario('cde12-cap3',EC,.25,1,list(kind='atMost',G=3L),
  'constrained-cde12-cap3-baseline',c('constrained-cde12-cap3-F-above-I','constrained-cde12-cap3-I-above-F'),fi)
relaxation('cde12-cap2-relax-cap3',cdeCap2,cdeCap3)

krw <- jsonlite::fromJSON(file.path(released_dir,'case-krw.json'),simplifyVector=FALSE)
EK <- from_released(krw$arrays$error)
stopifnot(length(EK$ids)==97L,identical(as.character(EK$criteria),c('race_signed','gender_signed')))
cap4Id <- 'constrained-krw97-cap4-baseline'; uncappedId <- 'constrained-krw97-uncapped-baseline'
fixedOrder <- vec(plainGrade(frozen[[cap4Id]]$args$options$family$order))
stopifnot(identical(sort(as.numeric(fixedOrder)),as.numeric(0:96)),
  identical(as.numeric(fixedOrder),plainGrade(frozen[[uncappedId]]$args$options$family$order)))
krwPairs <- list(list(label='forward-55-35',pair=vec(c(55L,35L))),list(label='reverse-35-55',pair=vec(c(35L,55L))))
krwCap4 <- frozenScenario('krw97-order-cap4',EK,.25,c(.5,.5),list(kind='order',order=fixedOrder,G=4L),cap4Id,
  c('constrained-krw97-cap4-stated','constrained-krw97-cap4-reverse-empty'),krwPairs)
krwUncapped <- frozenScenario('krw97-order-uncapped',EK,.25,c(.5,.5),list(kind='order',order=fixedOrder),uncappedId,
  c('constrained-krw97-uncapped-stated','constrained-krw97-uncapped-reverse-empty'),krwPairs)
stopifnot(match(55,as.numeric(fixedOrder))<match(35,as.numeric(fixedOrder)),
  krwCap4$targets[['reverse-35-55']]$empty,krwUncapped$targets[['reverse-35-55']]$empty)
relaxation('krw97-cap4-relax-same-order-uncapped',krwCap4,krwUncapped)

assert_no_postrank()
stopifnot(length(rows)>0L,!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3p4-withholding',rows,'r-export/42_v3_part4_withholding.R',uses_postrank=FALSE)
cat('oracle-v3p4-withholding:',length(rows),'rows;',sum(vapply(rows,function(r)r$args$fn=='pairConstrainedOptimum',TRUE)),
  'small constrained solves and',sum(vapply(rows,function(r)r$args$fn=='compareReports',TRUE)),
  'fresh fixed-report comparisons; no CDE-cap3 or KRW solve; all scientific checks PASS.\n')
