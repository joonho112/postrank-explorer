# Author: JoonHo Lee (jlee296@ua.edu)
# Independent base-R oracle for spec-v3-part5.md's two KRW functions.
# Authority: engine/API.md/README.md, public theory book ch10/ch20, public
# v1 G-09 source/presets, and released six-sites coefficients. No new TS,
# TS tests, other new writer output, JS execution, postrank namespace, solver,
# browser, private input or large-family search is used.
# Run from repo root, setting POSTRANK_SRC to the public package source in a WT.
source('r-export/_paths.R'); source('r-export/_helpers.R'); source('r-export/_oracle.R')
assert_no_postrank()
write_json_stable <- function(x,path) {
  dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE)
  writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE)
  invisible(path)
}

# Reuse only frozen base-R JSON/enumeration definitions, never R35's cases,
# expectations, source loading or writer. All new risk/set math is below.
pure <- c('vec','%or%','Mof','lexsort','gl','earr','uncube','allreports','familyCache','familyreports')
found <- character()
for(expr in parse('r-export/35_v3_part4.R')) {
  if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pure) {
    eval(expr); found <- c(found,as.character(expr[[2]]))
  }
}
stopifnot(setequal(found,pure)); assert_no_postrank()
scalar <- function(x) is.numeric(x)&&length(x)==1L&&!is.na(x)&&is.finite(x)
ksum <- function(x) {
  s <- 0; c <- 0
  for(v in x) { t <- s+v; c <- c+if(abs(s)>=abs(v))(s-t)+v else (v-t)+s; s <- t }
  s+c
}
bridge <- function(axis) {
  stopifnot(is.list(axis),!is.null(names(axis)),all(names(axis)%in%c('lambda','tau')),
    length(axis)==1L,scalar(axis[[1]]))
  if('lambda'%in%names(axis)) {
    lambda <- axis$lambda; stopifnot(lambda>0,lambda<=1); tau <- lambda/(1+lambda)
  } else {
    tau <- axis$tau; stopifnot(tau>0,tau<=.5); lambda <- tau/(1-tau)
  }
  list(lambda=lambda,tau=tau,cut=1/(1+lambda),informedShare=1-2*tau,slope=(1-lambda)/lambda)
}
finiteJSON <- function(x) {
  if(is.list(x))return(lapply(x,finiteJSON))
  if(is.numeric(x)&&length(x)==1L&&!is.finite(x))return(if(is.na(x))'NaN'else if(x>0)'Infinity'else '-Infinity')
  x
}
inputJSON <- function(x) {
  if(is.list(x))return(lapply(x,inputJSON))
  if(is.numeric(x)&&length(x)==1L&&!is.finite(x))return(list(`$num`=if(is.na(x))'NaN'else if(x>0)'Infinity'else '-Infinity'))
  x
}
validFamily <- function(n,f) {
  stopifnot(is.list(f),length(f$kind)==1L,is.character(f$kind),f$kind%in%c('all','atMost','exactly','order'))
  # Existing familySizeExact/checkCount accepts any SAFE integer count. A
  # count below one describes an empty family, rather than invalid input.
  integerCount <- function(x) scalar(x)&&abs(x)<=2^53-1&&x==floor(x)
  allowed <- switch(f$kind,all='kind',atMost=c('kind','G'),exactly=c('kind','G'),order=c('kind','order','G','exact','blocks'))
  stopifnot(all(names(f)%in%allowed))
  if(f$kind%in%c('atMost','exactly'))stopifnot(integerCount(f$G))
  if(f$kind=='order') {
    o <- as.numeric(f$order); stopifnot(length(o)==n,identical(sort(o),as.numeric(0:(n-1))))
    if('G'%in%names(f))stopifnot(integerCount(f$G))
    if('exact'%in%names(f))stopifnot(integerCount(f$exact))
    if('blocks'%in%names(f)) {
      b <- as.numeric(f$blocks); stopifnot(length(b)>0,all(is.finite(b)),all(b>=1),all(b==floor(b)),sum(b)==n)
    }
  }
  invisible(TRUE)
}
familySize <- function(n,f) {
  # Stirling recurrence is used only as a preflight, never to enumerate a large family.
  if(f$kind=='order') {
    B <- length(f$blocks %or% rep(1L,n))
    if(!is.null(f$exact)) {
      if(f$exact<1||f$exact>B||(!is.null(f$G)&&f$exact>f$G))return(0)
      return(choose(B-1,f$exact-1))
    }
    cap <- min(f$G %or% B,B); if(cap<1)return(0)
    return(sum(vapply(seq_len(cap),function(h)choose(B-1,h-1),0)))
  }
  if(f$kind%in%c('atMost','exactly')&&f$G<1)return(0)
  s <- matrix(0,n+1,n+1); s[1,1] <- 1
  for(a in seq_len(n))for(k in seq_len(a))s[a+1,k+1] <- k*s[a,k+1]+s[a,k]
  ks <- switch(f$kind,all=seq_len(n),atMost=seq_len(min(f$G,n)),exactly=f$G)
  ks <- ks[ks>=1&ks<=n]; sum(s[n+1,ks+1]*factorial(ks))
}
validate <- function(E,options) {
  stopifnot(is.list(options),!is.null(names(options)),
    all(names(options)%in%c('lambda','tau','family','tieTol','maxTies','tieFree','t')),
    identical(options$tieFree,TRUE))
  p <- bridge(options[names(options)%in%c('lambda','tau')])
  stopifnot(is.list(E),length(E$criteria)==1L,length(E$ids)>=2L,is.list(E$e),length(E$e)==1L)
  n <- length(E$ids)
  if(is.matrix(E$e[[1]]))stopifnot(identical(dim(E$e[[1]]),c(n,n)))else {
    stopifnot(is.list(E$e[[1]]),length(E$e[[1]])==n,all(vapply(E$e[[1]],length,0L)==n))
  }
  e <- uncube(E); stopifnot(identical(dim(e),c(n,n,1L)))
  v <- e[,,1][row(e[,,1])!=col(e[,,1])]
  stopifnot(all(is.finite(v)),all(v>=0&v<=1))
  for(i in seq_len(n-1))for(j in (i+1):n)stopifnot(abs(e[i,j,1]+e[j,i,1]-1)<=1e-12)
  if('t'%in%names(options)) {
    t <- options$t; stopifnot(is.list(t),length(t)==1L,length(t[[1]])==n)
    for(i in seq_len(n)) {
      stopifnot(length(t[[1]][[i]])==n)
      for(j in seq_len(n))if(i!=j) { x <- t[[1]][[i]][[j]]; stopifnot(scalar(x),x>=0,x<=1,x<=1e-15) }
    }
  }
  tol <- if('tieTol'%in%names(options))options$tieTol else 1e-12
  mt <- if('maxTies'%in%names(options))options$maxTies else 100L
  stopifnot(scalar(tol),tol>=0,scalar(mt),mt>=1,mt==floor(mt))
  # Inherit exactOptimum's pre-existing resolveFamily: null/undefined => all.
  f <- options$family %or% list(kind='all')
  validFamily(n,f); size <- familySize(n,f)
  # Existing exactOptimum returns an empty family before enumeration limits.
  stopifnot(size==0||(n<=20&&size<=600000))
  list(e=e[,,1],parameters=p,family=f,size=size,tieTol=tol,maxTies=mt)
}
counts <- function(G,e) {
  n <- ncol(G); N <- numeric(nrow(G)); E <- numeric(nrow(G))
  # Each report is integrated independently. The error sum is compensated;
  # directions are visited in row-major i,j order as public evaluateReport.
  for(r in seq_len(nrow(G))) {
    wrong <- numeric()
    for(i in seq_len(n))for(j in seq_len(n))if(G[r,i]<G[r,j])wrong <- c(wrong,e[i,j])
    N[r] <- length(wrong); E[r] <- ksum(wrong)
  }
  list(N=N,E=E)
}
countCache <- new.env(parent=emptyenv())
reportData <- function(e,f) {
  key <- digest::digest(list(e=e,f=f),algo='sha256')
  if(!exists(key,countCache,inherits=FALSE)) {
    # Frozen R35's enumerator predates zero/negative-cap pins. Preflight empty
    # families here instead of handing a negative length to its seq_len.
    G <- if(familySize(nrow(e),f)==0)matrix(integer(),0L,nrow(e))else familyreports(nrow(e),f)
    assign(key,c(list(G=G),counts(G,e)),countCache)
  }
  get(key,countCache,inherits=FALSE)
}
correspondence <- function(E,options,cloud=FALSE) {
  x <- validate(E,options); p <- x$parameters; tau <- p$tau; lambda <- p$lambda
  f <- x$family; d <- reportData(x$e,f); G <- d$G; size <- nrow(G); M <- Mof(ncol(G))
  stopifnot(size==x$size)
  family <- list(size=size)
  if(!size)return(list(parameters=p,family=family,reportsEnumerated=0L,
    postrank=list(empty=TRUE,family=family,containsAllWithheld=FALSE,label='exact-within-family'),
    krw=NULL,sameFullSet=NULL,maxAffineResidual=NULL))
  DR <- d$E/M; information <- (d$N-2*d$E)/M
  R <- DR+tau*(M-d$N)/M
  RK <- (1-lambda)*DR-lambda*information
  Z <- d$E-tau*d$N
  # The ordinary exactOptimum collector uses raw Zmin and tieTol*M.
  # Neither membership test is anchored to the chosen representative's risk.
  pr <- which(Z-min(Z)<=x$tieTol*M)
  kr <- which(RK-min(RK)<=x$tieTol/(1-tau))
  chosen <- pr[1]
  if(f$kind=='order') {
    ng <- apply(G[pr,,drop=FALSE],1,max); cand <- pr[ng==min(ng)]
    cuts <- lapply(cand,function(r)which(diff(G[r,as.numeric(f$order)+1L])>0))
    chosen <- if(length(cand)==1L)cand else cand[do.call(order,unname(as.data.frame(do.call(rbind,cuts))))[1]]
  }
  contains <- any(apply(G,1,function(g)all(g==1L)))
  post <- list(empty=FALSE,grade=vec(G[chosen,]),grades=gl(G[head(pr,x$maxTies),,drop=FALSE]),tieCount=length(pr),
    risk=R[chosen],family=family,containsAllWithheld=contains,label='exact-within-family',tieTol=x$tieTol)
  out <- list(parameters=p,family=family,reportsEnumerated=size,postrank=post,
    krw=list(grade=vec(G[kr[1],]),grades=gl(G[head(kr,x$maxTies),,drop=FALSE]),tieCount=length(kr),minRisk=min(RK),tieTol=x$tieTol/(1-tau)),
    sameFullSet=identical(pr,kr),maxAffineResidual=max(abs(R-(tau+(1-tau)*RK))))
  if(cloud)out$cloud <- lapply(seq_len(size),function(r)list(grade=vec(G[r,]),N=d$N[r],E=d$E[r],DR=DR[r],information=information[r],postrankRisk=R[r],krwRisk=RK[r]))
  out
}

rows <- list()
add <- function(id,fn,args,expect) {
  stopifnot(!id%in%vapply(rows,`[[`,'','id'))
  rows[[length(rows)+1L]] <<- list(id=id,args=c(list(fn=fn),inputJSON(args)),expect=finiteJSON(expect))
}
parameterRow <- function(id,axis) { p <- bridge(axis); add(paste0('krw-parameters-',id),'krwBridgeParameters',list(axis=axis),p); invisible(p) }
corrRow <- function(id,E,options,cloud=FALSE) {
  ans <- correspondence(E,options,cloud)
  args <- list(E=E,options=options); if(cloud)args$oracleView <- 'cloud'
  add(paste0('krw-correspondence-',id),'krwCorrespondence',args,ans); invisible(ans)
}
errorRow <- function(id,fn,args) {
  thrown <- tryCatch({if(fn=='krwBridgeParameters')bridge(args$axis)else correspondence(args$E,args$options);FALSE},error=function(e)TRUE)
  stopifnot(thrown); add(paste0('krw-reject-',id),fn,args,list(error=TRUE))
}
pairE <- function(ab,ba=1-ab) { e <- matrix(c(NA,ba,ab,NA),2,2); earr(e,c('A','B'),'scalar') }
halfE <- function(n) { e <- matrix(.5,n,n); diag(e) <- NA_real_; earr(e) }
opts <- function(axis=list(tau=.2),...)c(axis,list(tieFree=TRUE),list(...))
six <- jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE)
E6 <- earr(uncube(six$arrays$one),unlist(six$arrays$one$ids),unlist(six$arrays$one$criteria))
stopifnot(nrow(familyreports(6))==4683L,nrow(familyreports(6,list(kind='atMost',G=3L)))==603L)

# Public G-09's three presets; the default is lambda1. Extra practical source
# endpoints include the archived KRW lambda controls' .01/.08/.50 settings.
for(l in c(.01,.08,.25,.5,1)) {
  parameterRow(paste0('source-lambda-',l),list(lambda=l))
  corrRow(paste0('source-lambda-',l),E6,opts(list(lambda=l)))
}
parameterRow('source-tau25',list(tau=.25)); corrRow('source-tau25',E6,opts(list(tau=.25)))
parameterRow('source-tau01',list(tau=.01)); corrRow('source-tau01',E6,opts(list(tau=.01)))
# Every approved grid row, each independently evaluated with matching lambda.
grid <- lapply(2:50,function(i) {
  tau <- i/100; parameterRow(sprintf('grid-tau%02d',i),list(tau=tau))
  corrRow(sprintf('grid-tau%02d',i),E6,opts(list(lambda=tau/(1-tau))))
})
tauGrid <- lapply(2:50,function(i)corrRow(sprintf('grid-tau-axis-%02d',i),E6,opts(list(tau=i/100))))
stopifnot(length(grid)==49L,all(vapply(grid,`[[`,TRUE,'sameFullSet')),
  length(tauGrid)==49L,all(vapply(tauGrid,`[[`,TRUE,'sameFullSet')),
  all(vapply(c(grid,tauGrid),function(r)length(r$postrank$grades)==r$postrank$tieCount,TRUE)),
  all(vapply(c(grid,tauGrid),function(r)length(r$krw$grades)==r$krw$tieCount,TRUE)))
cloud <- corrRow('six-cloud-lambda25',E6,opts(list(lambda=.25)),TRUE)
stopifnot(length(cloud$cloud)==4683L,cloud$reportsEnumerated==4683L,
  identical(as.numeric(cloud$postrank$grade),c(1,2,3,3,4,5)),cloud$sameFullSet,
  any(vapply(cloud$cloud,function(r)r$N==0&&r$DR==0&&r$information==0,TRUE)))

# Cap/exact/common-order/indivisible-block domains use precisely the same
# complete family on both sides. No unrestricted large-case optimum is claimed.
for(f in list(list(kind='atMost',G=3L),list(kind='exactly',G=3L),
  list(kind='order',order=vec(0:5)),list(kind='order',order=vec(0:5),G=3L),
  list(kind='order',order=vec(0:5),exact=3L),
  list(kind='order',order=vec(c(2,0,3,1,5,4)),blocks=vec(c(2,1,2,1)),G=3L))) {
  corrRow(paste0('six-family-',length(rows)),E6,opts(family=f))
}
for(v in c(0,.2,.5,1))corrRow(paste0('pair-e',v),pairE(v),opts(list(tau=if(v==.5).5 else .2)))
for(delta in c(-2e-12,-5e-13,0,5e-13,2e-12))corrRow(paste0('pair-boundary-',sprintf('%.1e',delta)),pairE(.2),opts(list(tau=.2+delta)))
full <- corrRow('three-way-full',halfE(3),opts(list(tau=.5),maxTies=20L))
trunc <- corrRow('three-way-truncated1',halfE(3),opts(list(tau=.5),maxTies=1L))
stopifnot(full$postrank$tieCount==13L,full$krw$tieCount==13L,length(full$postrank$grades)==13L,
  trunc$postrank$tieCount==13L,trunc$krw$tieCount==13L,length(trunc$postrank$grades)==1L,trunc$sameFullSet)
# The chosen lexicographic report has a risk slightly above the raw minimum.
# A representative-risk anchor would wrongly enlarge the tolerance set.
near <- matrix(.5,3,3); diag(near) <- NA_real_; a <- 4e-13
near[1,2] <- .5-a; near[1,3] <- .5-2*a; near[2,3] <- .5-3*a
for(i in 1:2)for(j in (i+1):3)near[j,i] <- 1-near[i,j]
nearAns <- corrRow('raw-min-before-truncation',earr(near),opts(list(tau=.5),maxTies=1L))
stopifnot(nearAns$postrank$tieCount<13L,nearAns$postrank$tieCount>1L,nearAns$sameFullSet)
nearFull <- corrRow('raw-min-complete-sets',earr(near),opts(list(tau=.5),maxTies=20L))
stopifnot(length(nearFull$postrank$grades)==nearAns$postrank$tieCount,nearFull$sameFullSet)
oe <- matrix(.1,3,3); diag(oe) <- NA_real_; oe[1,3] <- .05
for(i in 1:2)for(j in (i+1):3)oe[j,i] <- 1-oe[i,j]
ordered <- corrRow('order-package-representative',earr(oe),opts(family=list(kind='order',order=vec(0:2),G=2L)))
stopifnot(ordered$postrank$tieCount==2L,identical(as.numeric(ordered$postrank$grade),c(1,2,2)),
  identical(as.numeric(ordered$krw$grade),c(1,1,2)),ordered$sameFullSet)
for(f in list(list(kind='exactly',G=4L),list(kind='order',order=vec(0:2),blocks=vec(c(1,2)),exact=3L))) {
  empty <- corrRow(paste0('empty-',length(rows)),halfE(3),opts(family=f))
  stopifnot(empty$reportsEnumerated==0L,empty$postrank$empty,is.null(empty$krw),is.null(empty$sameFullSet),is.null(empty$maxAffineResidual))
}
for(f in list(list(kind='atMost',G=1L),list(kind='exactly',G=3L),list(kind='order',order=vec(0:2),exact=2L)))corrRow(paste0('small-family-',length(rows)),halfE(3),opts(list(tau=.5),family=f))
corrRow('unit-limit-small-family',halfE(20),opts(family=list(kind='atMost',G=1L)))
zeroT <- list(lapply(seq_len(2),function(i)lapply(seq_len(2),function(j)if(i==j)NULL else 0)))
tinyT <- zeroT; tinyT[[1]][[1]][[2]] <- 1e-15
corrRow('explicit-zero-equality',pairE(.2),opts(t=zeroT))
corrRow('equality-check-boundary',pairE(.2),opts(t=tinyT))
corrRow('reciprocity-tolerance-inside',pairE(.2,.8+5e-13),opts())
for(x in c(.Machine$double.xmin,.Machine$double.xmin*.Machine$double.eps,1e-100)) {
  parameterRow(paste0('positive-small-lambda-',sprintf('%.17g',x)),list(lambda=x))
  parameterRow(paste0('positive-small-tau-',sprintf('%.17g',x)),list(tau=x))
}
for(axis in list(list(lambda=1-.Machine$double.eps/2),list(tau=.5-.Machine$double.eps/4),list(lambda=1/3)))parameterRow(paste0('upper-neighbor-',length(rows)),axis)
for(tol in c(0,1e-8))corrRow(paste0('explicit-tolerance-',tol),pairE(.2),opts(tieTol=tol,maxTies=2L))
hidden <- corrRow('zero-tolerance-hidden-full-set-difference',pairE(.2),opts(tieTol=0,maxTies=1L))
stopifnot(!hidden$sameFullSet,hidden$postrank$tieCount==2L,hidden$krw$tieCount==1L,
  identical(hidden$postrank$grades,hidden$krw$grades))
corrRow('positive-subnormal-axis',pairE(.2),opts(list(lambda=.Machine$double.xmin*.Machine$double.eps)))

# Invalid input pins retain the same two public fn names. The adapter catches
# errors and returns {error:true}; special numeric inputs use {$num:...}.
badAxes <- list(list(),list(lambda=.2,tau=.2),list(lambda=0),list(lambda=-1),list(lambda=1+.Machine$double.eps),
  list(tau=0),list(tau=-.1),list(tau=.5+.Machine$double.eps/2),list(lambda='0.25'),list(tau=TRUE),
  list(lambda=NULL),list(lambda=Inf),list(tau=NaN),list(lambda=.25,typo=1))
for(i in seq_along(badAxes)) {
  errorRow(paste0('axis-',i),'krwBridgeParameters',list(axis=badAxes[[i]]))
  errorRow(paste0('correspondence-axis-',i),'krwCorrespondence',list(E=pairE(.2),options=c(badAxes[[i]],list(tieFree=TRUE))))
}
badOpts <- list(list(tau=.2),list(tau=.2,tieFree=FALSE),list(tau=.2,tieFree=1),list(tau=.2,tieFree=NULL),
  opts(tieTol=NULL),opts(tieTol=Inf),opts(tieTol=-1),opts(maxTies=NULL),opts(maxTies=Inf),
  opts(maxTies=0),opts(maxTies=1.5),opts(q=list(.2)),opts(w=vec(1)),opts(typo=1),
  opts(family=NULL),opts(family=list(kind='all',G=2)),opts(family=list(kind='atMost',G=0)),
  opts(family=list(kind='order',order=vec(c(0,0)))),opts(family=list(kind='order',order=vec(0:1),blocks=vec(c(1,2)))))
for(i in seq_along(badOpts)) {
  args <- list(E=pairE(.2),options=badOpts[[i]])
  if(i%in%c(15L,17L)) {
    # Preserve the original IDs/inputs as audit links. Their corrected
    # expectations are ordinary outputs, despite the historical reject ID.
    ans <- correspondence(args$E,args$options)
    add(paste0('krw-reject-options-',i),'krwCorrespondence',args,ans)
    if(i==15L)stopifnot(ans$reportsEnumerated==3L,!ans$postrank$empty,ans$sameFullSet)
    if(i==17L)stopifnot(ans$reportsEnumerated==0L,ans$postrank$empty,is.null(ans$krw))
  } else errorRow(paste0('options-',i),'krwCorrespondence',args)
}
badT <- zeroT; badT[[1]][[1]][[2]] <- 2e-15
errorRow('equality-mass','krwCorrespondence',list(E=pairE(.2),options=opts(t=badT)))
errorRow('equality-shape','krwCorrespondence',list(E=pairE(.2),options=opts(t=list(list(list(0))))))
badT[[1]][[1]][[2]] <- -.1
errorRow('equality-range','krwCorrespondence',list(E=pairE(.2),options=opts(t=badT)))
E2 <- pairE(.2); E2$criteria <- vec(c('a','b')); E2$e <- c(E2$e,E2$e)
errorRow('multiple-criteria','krwCorrespondence',list(E=E2,options=opts()))
badShape <- pairE(.2); badShape$e <- list(list(list(NULL,.2)))
errorRow('coefficient-shape','krwCorrespondence',list(E=badShape,options=opts()))
badShape <- pairE(.2); badShape$e[[1]][1,2] <- NA_real_
errorRow('coefficient-nonfinite','krwCorrespondence',list(E=badShape,options=opts()))
for(E in list(pairE(.2,.7),pairE(-.1,1.1),pairE(.2,.8+2e-12)))errorRow(paste0('coefficient-',length(rows)),'krwCorrespondence',list(E=E,options=opts()))
errorRow('report-budget','krwCorrespondence',list(E=halfE(9),options=opts()))
errorRow('unit-budget','krwCorrespondence',list(E=halfE(21),options=opts(family=list(kind='atMost',G=1L))))

# Appended after every original row so all existing row IDs remain stable.
emptyFamilies <- list(list(kind='exactly',G=0L),list(kind='order',order=vec(0:2),G=0L),
  list(kind='order',order=vec(0:2),exact=0L),list(kind='order',order=vec(0:2),G=0L,exact=1L),
  list(kind='order',order=vec(0:2),G=1L,exact=2L),list(kind='atMost',G=-1L),
  list(kind='exactly',G=-1L),list(kind='order',order=vec(0:2),G=-1L),
  list(kind='order',order=vec(0:2),exact=-1L))
for(i in seq_along(emptyFamilies)) {
  ans <- corrRow(paste0('inherited-empty-family-',i),halfE(3),opts(family=emptyFamilies[[i]]))
  stopifnot(ans$family$size==0L,ans$reportsEnumerated==0L,ans$postrank$empty,
    !ans$postrank$containsAllWithheld,is.null(ans$krw),is.null(ans$sameFullSet),is.null(ans$maxAffineResidual))
}
emptyAboveLimit <- corrRow('empty-before-unit-budget',halfE(21),opts(family=list(kind='atMost',G=0L)))
stopifnot(emptyAboveLimit$reportsEnumerated==0L,emptyAboveLimit$postrank$empty)
errorRow('family-noninteger-count','krwCorrespondence',list(E=pairE(.2),options=opts(family=list(kind='atMost',G=.5))))
errorRow('family-unsafe-count','krwCorrespondence',list(E=pairE(.2),options=opts(family=list(kind='exactly',G=2^53))))

assert_no_postrank()
stopifnot(length(unique(vapply(rows,`[[`,'','id')))==length(rows))
write_golden('oracle-v3p5-krw',rows,'r-export/44_v3_part5_krw.R',uses_postrank=FALSE)
written <- jsonlite::fromJSON(file.path(golden_dir,'oracle-v3p5-krw.json'),simplifyVector=FALSE)
stopifnot(length(written$rows)==length(rows),identical(written$uses_postrank,FALSE))
manifest <- jsonlite::fromJSON(file.path(manifest_dir,'oracle-v3p5-krw.json'))
stopifnot(identical(manifest$sha256,sha256_file(file.path(golden_dir,'oracle-v3p5-krw.json'))),
  manifest$rows==length(rows),identical(manifest$uses_postrank,FALSE))
numbers <- function(x) {
  if(is.list(x))return(unlist(lapply(x,numbers),use.names=FALSE))
  if(is.numeric(x))return(as.numeric(x[is.finite(x)]))
  numeric()
}
stopifnot(identical(sort(numbers(rows)),sort(numbers(written$rows))))
assert_no_postrank()
cat('oracle-v3p5-krw:',length(rows),'rows;49 complete grid sets on each axis,4683 cloud reports;',
  length(numbers(rows)),'finite numbers exactly round-trip at17digits; invalid inputs, ties, truncation,',
  'caps/orders/blocks/empty and base-R independence PASS.\n')
