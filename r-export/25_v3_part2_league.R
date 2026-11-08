# Author: JoonHo Lee (jlee296@ua.edu).
# Part 2 reported-and-realized UI pins. Independent base R only; no JS or postrank.
# Reports are FIXED inputs from the existing independently enumerated oracle-v3 league rows.
# This supplement checks their evaluation, not a second implementation of report selection.
# Deterministic theta is never treated as a sample from either conditional law.
source('r-export/_paths.R')
source('r-export/_helpers.R')
source('r-export/_oracle.R')
source('r-export/_rng.R')
assert_no_postrank()
vec <- function(x) I(unname(x))
baseline <- jsonlite::fromJSON(file.path(golden_dir,'oracle-v3.json'),simplifyVector=FALSE)$rows
settings <- list(
 list(id='same',row='leagueGradingReplays-defaults'),
 list(id='narrow',row='leagueGradingReplays-seed20261030-R5-prior.05-tau.3-cap5'),
 list(id='fewer',row='leagueGradingReplays-seed20261030-R5-prior.15-tau.1-cap2'),
 list(id='silent',row='leagueGradingReplays-seed20261030-R3-cap1-nothing-stated'))
truth <- .15*qnorm((((19*(1:30))%%31)-.5)/30)
se <- rep(c(.2,.1,.05),10)
post <- function(y,sd) { B<-sd^2/(sd^2+se^2);list(mean=B*y,sd=sqrt(B)*se) }
errors <- function(p) {
 z<-outer(p$mean,p$mean,'-')/sqrt(outer(p$sd^2,p$sd^2,'+'))
 e<-pnorm(-z);diag(e)<-0;e
}
wrong <- function(g,t) sum(outer(g,g,'<') & outer(t,t,'<='))
rows <- list()
make_row <- function(id,args) {
 g<-unlist(args$grade)
 y<-truth+se*prx_normals(args$baseSeed+args$replay,30)
 a<-post(y,args$priorSd);ref<-post(y,args$referenceSd)
 ea<-errors(a);er<-errors(ref);stated<-outer(g,g,'<');N<-sum(stated)
 claimE<-sum(ea[stated]);referenceE<-sum(er[stated]);delta<-max(abs(ea-er));D<-wrong(g,truth)
 law<-if(args$drawLaw=='reference') ref else a
 E<-if(args$drawLaw=='reference') referenceE else claimE
 S<-args$draws
 if(S>0) {
  z<-matrix(prx_normals(args$seed,S*30),nrow=S,ncol=30,byrow=TRUE)
  latent<-sweep(sweep(z,2,law$sd,'*'),2,law$mean,'+')
  ds<-apply(latent,1,function(t)wrong(g,t))
 } else ds<-numeric()
 expectation<-list(N=N,claimedE=claimE,referenceE=referenceE,
  claimedShare=if(N)claimE/N else NULL,referenceShare=if(N)referenceE/N else NULL,
  delta=delta,shareGap=if(N)abs(claimE-referenceE)/N else NULL,
  D=D,realizedShare=if(N)D/N else NULL,drawExpected=E,
  drawAverage=if(S)mean(ds) else NULL,drawCounts=vec(ds))
 if(N>0)stopifnot(expectation$shareGap<=delta+1e-14)
 list(id=id,args=args,expect=expectation)
}
for(s in settings) {
 b<-Filter(function(x)x$id==s$row,baseline)[[1]]$expect
 for(r in seq_along(b$r)) {
  args<-list(baselineGroup='oracle-v3',baselineRow=s$row,baseSeed=20261030L,
   replay=r,replays=length(b$r),priorSd=b$priorSd,referenceSd=.15,tau=b$tau,cap=b$cap,
   grade=vec(unlist(b$grade[[r]])),drawLaw='reference',draws=100L,seed=1L)
  row<-make_row(paste0('reported-realized-',s$id,'-r',r),args)
  # Verify fixed input reports against their original independent baseline values.
  stopifnot(row$expect$N==b$N[[r]],row$expect$D==b$D[[r]],
    abs(row$expect$claimedE-b$E[[r]])<1e-11)
  rows[[length(rows)+1L]]<-row
 }
}
# Reader controls: switching the draw law, clearing all draws, and taking the first draw.
for(z in list(list(base='narrow',law='assumed',S=100L,id='assumed'),
              list(base='same',law='reference',S=0L,id='zero-draws'),
              list(base='same',law='reference',S=1L,id='one-draw'))) {
 a<-Filter(function(x)x$id==paste0('reported-realized-',z$base,'-r1'),rows)[[1]]$args
 a$drawLaw<-z$law;a$draws<-z$S
 rows[[length(rows)+1L]]<-make_row(paste0('reported-realized-',z$base,'-r1-',z$id),a)
}
write_golden('oracle-v3p2-league',rows,generator='r-export/25_v3_part2_league.R',uses_postrank=FALSE)
cat('oracle-v3p2-league:',length(rows),'fixed-report rows; deterministic truth and two declared conditional laws\n')
