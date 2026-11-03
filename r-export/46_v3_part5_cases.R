# Author: JoonHo Lee (jlee296@ua.edu)
# Independent base-R case fixtures: spec-v3-part5-cases.md and published API.
# No new app source, TS solver code, JS output, postrank namespace, private
# input, network, or unrestricted large-case solve. Only public released inputs.
source('r-export/_paths.R'); source('r-export/_helpers.R'); source('r-export/_oracle.R')
assert_no_postrank()
write_json_stable <- function(x,path) {
  dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE)
  writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE)
  invisible(path)
}
pure <- c('vec','%or%','Mof','close','lexsort','gl','earr','uncube','weights','evaluate','change',
  'allreports','familyCache','familyreports','optimum','decadd','decsum','countjson','compare')
found <- character()
for(expr in parse('r-export/35_v3_part4.R'))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&
  is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pure) {
  eval(expr); found <- c(found,as.character(expr[[2]]))
}
stopifnot(setequal(found,pure)); assert_no_postrank()
release <- function(key)jsonlite::fromJSON(file.path(released_dir,paste0(key,'.json')),simplifyVector=FALSE)
num <- function(x)as.numeric(unlist(x,use.names=FALSE))
ksum <- function(x){s<-0;c<-0;for(v in x){t<-s+v;c<-c+if(abs(s)>=abs(v))(s-t)+v else(v-t)+s;s<-t};s+c}
rowSum <- function(e)apply(e,1,function(v)ksum(v[!is.na(v)]))
weighted <- function(e,w){z<-e[,,1]*w[1];if(length(w)>1)for(k in 2:length(w))z<-z+e[,,k]*w[k];z}
rankOrder <- function(e,w,ids) {
  er <- 1+rowSum(weighted(e,w)); o <- order(er,ids,method='radix')
  list(expectedRank=vec(er),order=vec(o-1L),blocks=vec(rle(er[o])$lengths))
}
sizes <- function(g)vec(tabulate(as.integer(g),max(g)))
units <- function(g) {
  n<-length(g);a<-rowSums(outer(g,g,'<'));b<-rowSums(outer(g,g,'>'))
  list(n=n,partners=n-1L,above=vec(a),below=vec(b),stated=vec(a+b),withheld=vec(n-1L-a-b))
}
between <- function(g,e,w) {
  eb<-weighted(e,w);out<-list();G<-max(g)
  if(G>1)for(h in seq_len(G-1L))for(hp in (h+1L):G) {
    v<-eb[g==h,g==hp,drop=FALSE]
    out[[length(out)+1L]]<-list(h=h,hp=hp,pairs=length(v),meanError=sum(v)/length(v),maxError=max(v))
  };out
}
diagnostics <- function(g,e,tau) {
  x<-e[,,1];n<-length(g);conf<-withheld<-statedAbove<-0L
  for(i in seq_len(n-1L))for(j in (i+1L):n) {
    if(min(x[i,j],x[j,i])<tau){conf<-conf+1L;if(g[i]==g[j])withheld<-withheld+1L}
    if(g[i]!=g[j]&&(if(g[i]<g[j])x[i,j]else x[j,i])>tau+1e-12)statedAbove<-statedAbove+1L
  }
  st<-outer(g,g,'<');above<-rowSums(x<tau,na.rm=TRUE)
  list(thresholdCount=sum(above),aboveCounts=vec(above),
    confident=list(count=conf,withheld=withheld,stated=conf-withheld),
    statedAbove=list(count=statedAbove,max=if(any(st))max(x[st])else NULL))
}
relationOnly <- function(g0,g1) {
  n<-length(g0);M<-Mof(n);ct<-c(nSame=0L,nNewDisclosed=0L,nNewWithheld=0L,nReversed=0L);pp<-list();nm<-c('below','withheld','above')
  for(i in seq_len(n-1L))for(j in (i+1L):n) {
    a<-sign(g0[j]-g0[i]);b<-sign(g1[j]-g1[i]);key<-if(a==b)'nSame'else if(a==0)'nNewDisclosed'else if(b==0)'nNewWithheld'else'nReversed';ct[key]<-ct[key]+1L
    if(a!=b)pp[[length(pp)+1L]]<-list(i=i-1L,j=j-1L,from=nm[a+2L],to=nm[b+2L],error=NULL)
  }
  c(list(M=M),as.list(ct),list(agreement=unname(ct['nSame']/M),pairs=pp,changed=unname(M-ct['nSame']),changeShare=unname((M-ct['nSame'])/M)))
}
# Independent fixed-order DP: upper-triangle segment adjustments, rectangular
# prefix sums, then a grade-count/last-position recurrence. No order enumeration.
orderDP <- function(e,w,tau,ord,cap) {
  n<-dim(e)[1];M<-Mof(n);o<-as.integer(ord$order)+1L;bl<-as.integer(ord$blocks);B<-length(bl);bd<-c(0L,cumsum(bl))
  eb<-weighted(e,w)[o,o];cost<-matrix(0,n,n);cost[upper.tri(cost)]<-tau-eb[upper.tri(eb)]
  P<-matrix(0,n+1L,n+1L)
  for(i in seq_len(n))for(j in seq_len(n))P[i+1L,j+1L]<-cost[i,j]+P[i,j+1L]+P[i+1L,j]-P[i,j]
  seg<-matrix(0,B,B)
  for(l in seq_len(B))for(r in l:B){a<-bd[l];b<-bd[r+1L];seg[l,r]<-P[b+1L,b+1L]-P[a+1L,b+1L]-P[b+1L,a+1L]+P[a+1L,a+1L]}
  H<-min(cap,B);V<-matrix(Inf,H+1L,B+1L);V[1,1]<-0;pred<-vector('list',(H+1L)*(B+1L));slot<-function(h,r)h*(B+1L)+r+1L
  ways<-matrix(0,H+1L,B+1L);ways[1,1]<-1
  for(h in seq_len(H))for(r in h:B) {
    b<-(h-1L):(r-1L);v<-V[h,b+1L]+seg[cbind(b+1L,r)];best<-min(v)
    if(is.finite(best)){V[h+1L,r+1L]<-best;p<-b[v-best<=1e-12*M];pred[[slot(h,r)]]<-p;ways[h+1L,r+1L]<-sum(ways[h,p+1L])}
  }
  hs<-seq_len(H);best<-min(V[hs+1L,B+1L]);hs<-hs[V[hs+1L,B+1L]-best<=1e-12*M]
  tieCount<-sum(ways[hs+1L,B+1L]);stopifnot(tieCount*n<=2e6)
  gg<-list();walk<-function(h,r,cuts=integer()) {
    if(h==0L){g<-integer(n);g[o]<-1L+findInterval(seq_len(n)-1L,bd[sort(cuts)+1L]);gg[[length(gg)+1L]]<<-g;return(invisible(NULL))}
    for(b in pred[[slot(h,r)]])walk(h-1L,b,if(b>0)c(b,cuts)else cuts)
  }
  for(h in hs)walk(h,B)
  T<-lexsort(do.call(rbind,gg));stopifnot(nrow(T)==tieCount)
  ng<-apply(T,1,max);cand<-which(ng==min(ng));cc<-lapply(cand,function(r)which(diff(T[r,o])>0))
  chosen<-if(length(cand)==1L)cand else cand[do.call(order,unname(as.data.frame(do.call(rbind,cc))))[1]]
  g<-T[chosen,];ev<-evaluate(g,e,tau,w);cut<-which(diff(g[o])>0)
  stopifnot(max(g)<=cap,all(diff(g[o])>=0),ev$risk<=tau+1e-12,
    all(vapply(gl(T),function(gg)abs(evaluate(gg,e,tau,w)$risk-ev$risk)<=1e-12,TRUE)))
  list(empty=FALSE,grade=vec(g),grades=gl(head(T,100L)),gradesOrder='lexicographic',tieCount=tieCount,tieTol=1e-12,
    order=ord$order,blocks=ord$blocks,cuts=vec(cut),blockCuts=vec(match(cut,bd[-c(1L,length(bd))])),
    family=list(size=sum(vapply(seq_len(H),function(h)choose(B-1L,h-1L),0))),
    containsAllWithheld=TRUE,label='optimal-within-order',evaluation=ev,risk=ev$risk,N=ev$N,G=ev$G,Ew=ev$Ew,E=ev$E,EoverN=ev$EoverN)
}
rows<-list()
add<-function(id,fn,args,expect){stopifnot(!id%in%vapply(rows,`[[`,'','id'));rows[[length(rows)+1L]]<<-list(id=id,args=c(list(fn=fn),args),expect=expect);invisible(expect)}
krw<-release('case-krw');kg<-release('krw-lambda-grid');fold<-release('krw-absolute-gender')
cde<-release('case-cde');cp<-release('cde-taupath');ala<-release('case-alabama')
ek<-uncube(krw$arrays$error);ef<-uncube(fold$arrays$error);ec<-uncube(cde$arrays$error);ea<-uncube(ala$arrays$error)
idsK<-unlist(krw$arrays$error$ids);idsA<-unlist(ala$arrays$error$ids);idsC<-unlist(cde$arrays$error$ids)
stopifnot(length(idsK)==97L,dim(ef)[3]==1L,identical(idsK,unlist(fold$arrays$error$ids)),length(idsC)==12L,length(idsA)==67L)
stopifnot(identical(idsK,unlist(kg$tables$firms$id)),identical(idsK,unlist(krw$tables$reports$id)),
  identical(idsC,unlist(cde$tables$units$cds_id)),identical(idsA,unlist(ala$tables$reports$fips)),
  identical(unlist(cp$arrays$grades$ids),unlist(cde$tables$units$label)))
selected<-c(1L,8L,10L,25L,30L,50L,97L,98L,99L,100L)
firstSplit<-list()
for(k in 1:2) {
  criterion<-c('race','gender')[k];e<-ek[,,k,drop=FALSE];means<-num(krw$tables$units[[c('mean_race','mean_gender')[k]]]);er<-1+rowSum(e[,,1])
  grades<-kg$arrays[[criterion]]$grade
  first<-which(vapply(grades,function(g)length(unique(num(g)))>1L,TRUE))[1L]-1L
  firstGrade<-num(grades[[first+1L]])
  firstSplit[[criterion]]<-list(index=first,lambda=num(kg$facts$lambda)[first+1L],grade=vec(firstGrade),sizes=sizes(firstGrade))
  for(index in 0:100) {
    lambda<-num(kg$facts$lambda)[index+1L];tau<-if(lambda>0)lambda/(1+lambda)else 0;g<-num(grades[[index+1L]])
    ev<-evaluate(g,e,if(tau>0)tau else .2,1);DR<-as.numeric(ev$E)[1]/ev$M;information<-(ev$N-2*as.numeric(ev$E)[1])/ev$M
    dg<-diagnostics(g,e,tau)
    if(index==0L){ev$risk<-ev$errorTerm<-ev$withholdingTerm<-ev$Rk<-NULL;ev<-c(ev,list(risk=NULL,errorTerm=NULL,withholdingTerm=NULL,Rk=NULL));dg$confident<-dg$statedAbove<-NULL}
    add(sprintf('krw-grid-%s-%03d',criterion,index),'caseKrwGrid',list(criterion=criterion,index=index),
      list(lambda=lambda,tau=tau,grade=vec(g),sizes=sizes(g),evaluation=ev,DR=DR,information=information,
        thresholdCount=dg$thresholdCount,confident=dg$confident,statedAbove=dg$statedAbove))
    if(index%in%selected) {
      ur<-units(g);oER<-order(g,er,idsK,method='radix');oMean<-order(g,-means,idsK,method='radix');shift<-match(seq_along(g),oER)-match(seq_along(g),oMean)
      gr<-lapply(seq_len(max(g)),function(h){ii<-which(g==h);list(grade=h,units=vec(ii-1L),size=length(ii),withinPairs=Mof(length(ii)),abovePairs=sum(ur$above[ii]),belowPairs=sum(ur$below[ii]))})
      add(sprintf('krw-details-%s-%03d',criterion,index),'caseKrwGridDetails',list(criterion=criterion,index=index),
        list(aboveCounts=dg$aboveCounts,unitCounts=ur,gradeUnits=gr,between=between(g,e,1),
          expectedRank=vec(er),expectedRankRows=vec(oER-1L),meanRows=vec(oMean-1L),shift=vec(shift),maxAbsShift=max(abs(shift)),
          movedCount=sum(shift!=0),mostMoved=vec(if(any(shift!=0))which(abs(shift)==max(abs(shift)))-1L else integer()),
          previous=change(num(grades[[index]]),g,e,1)))
    }
  }
}
add('krw-grid-first-splits','caseKrwFirstSplits',list(),firstSplit)
# Source-required baseline directions more often wrong than right. Public
# statedAbove uses error > threshold + its default risk tolerance 1e-12 and
# orders the stated (above,below) indices lexicographically.
genderBaseline<-num(kg$arrays$gender$grade[[26L]]);halfPairs<-list()
for(i in 1:97)for(j in 1:97)if(genderBaseline[i]<genderBaseline[j]&&ek[i,j,2]>.5+1e-12)
  halfPairs[[length(halfPairs)+1L]]<-list(i=i-1L,j=j-1L,error=ek[i,j,2])
add('krw-gender-baseline-stated-half','caseKrwStatedHalf',list(criterion='gender',index=25L,tauThreshold=.5),
  list(count=length(halfPairs),pairs=halfPairs))

target<-list()
for(which in c('signed','folded')) {
  e<-if(which=='signed')ek[,,2,drop=FALSE]else ef;ord<-rankOrder(e,1,idsK);dp<-orderDP(e,1,.2,ord,4L)
  target[[which]]<-list(expectedRank=ord$expectedRank,optimum=dp)
}
add('krw-gender-targets','caseGenderTargets',list(tau=.2,cap=4L,tieTol=1e-12),
  c(target,list(change=relationOnly(target$signed$optimum$grade,target$folded$optimum$grade))))

archiveK<-num(krw$analyses$case_krw_signed97$tables$units$grade)
cardsK<-list(race=num(krw$tables$reports$race_card),gender=num(krw$tables$reports$gender_card))
crossing<-function(g,e,tau){r<-as.numeric(evaluate(g,e,tau,c(.5,.5))$Rk);x<-(tau-r[2])/(r[1]-r[2]);if(!is.finite(x)||x<=0||x>=1)NULL else x}
for(w0 in c(0,.1,.25,.5,.75,.9,1)) {
  w<-c(w0,1-w0);ord<-rankOrder(ek,w,idsK);dp<-orderDP(ek,w,.25,ord,4L)
  add(paste0('krw-two-w',w0),'caseKrwTwoTarget',list(w=vec(w),tau=.25,cap=4L),
    list(expectedRank=ord$expectedRank,live=dp,archiveGrade=vec(archiveK),archiveEvaluation=evaluate(archiveK,ek,.25,w),
      archiveAgreement=identical(as.numeric(dp$grade),archiveK),cards=lapply(cardsK,function(g)list(grade=vec(g),evaluation=evaluate(g,ek,.25,w))),
      cardSelection=list(lambda=krw$facts$card_lambda,tau=krw$facts$card_tau),
      archiveSource=krw$analyses$case_krw_signed97$facts[c('tau','G_max','weights','risk','lower_bound','gap','status','bound_source')]))
}
add('krw-fixed-card-crossings','caseKrwCrossings',list(tau=.25),lapply(c(cardsK,list(common=archiveK)),function(g)crossing(g,ek,.25)))

# One new legacy control pin; frozen R44 remains read-only. Extract only its
# independent pure definitions, never its cases, writer or golden output.
pure44<-c('scalar','bridge','validFamily','familySize','validate','counts','countCache','reportData','correspondence')
found44<-character()
for(expr in parse('r-export/44_v3_part5_krw.R'))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&
  is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pure44){eval(expr);found44<-c(found44,as.character(expr[[2]]))}
stopifnot(setequal(found44,pure44))
six<-release('six-sites');e6<-six$arrays$one
add('case-bridge-lambda10','caseBridgePresets',list(data='six-sites',array='one',axis=list(lambda=.1)),
  correspondence(e6,list(lambda=.1,tieFree=TRUE)))

# CDE: one complete enumeration, reused for every frontier/constraint query.
fc<-list(kind='atMost',G=3L);GC<-familyreports(12L,fc);stopifnot(nrow(GC)==523251L)
NC<-integer(nrow(GC));EC<-numeric(nrow(GC))
for(i in 1:11)for(j in (i+1L):12) {
  lt<-GC[,i]<GC[,j];gt<-GC[,i]>GC[,j];NC<-NC+(lt|gt)
  EC<-EC+ifelse(lt,ec[i,j,1],ifelse(gt,ec[j,i,1],0))
}
oC<-order(-num(cde$tables$units$mean),idsC,method='radix')
stopifnot(identical(unlist(cde$tables$units$label)[oC],c('A','C','B','F','E','D','H','G','I','K','L','J')))
optC<-function(tau,ix=seq_len(nrow(GC)),maxTies=100L) {
  z<-EC[ix]-tau*NC[ix];jj<-ix[z-min(z)<=1e-12*66];g<-GC[jj[1L],];ev<-evaluate(g,ec,tau,1)
  list(grade=vec(g),grades=gl(GC[head(jj,maxTies),,drop=FALSE]),tieCount=length(jj),tieTol=1e-12,
    risk=ev$risk,evaluation=ev,family=list(size=length(ix)),containsAllWithheld=any(NC[ix]==0L),label='exact-within-family')
}
cloud<-lapply(sort(unique(NC)),function(N) {
  ix<-which(NC==N);lo<-min(EC[ix]);pick<-ix[which.min(EC[ix])]
  list(N=N,minEw=lo,maxEw=max(EC[ix]),count=length(ix),grade=vec(GC[pick,]))
})
h<-integer()
for(i in seq_along(cloud)) {
  while(length(h)>=2L) {
    a<-cloud[[h[length(h)-1L]]];b<-cloud[[h[length(h)]]];c<-cloud[[i]]
    if((b$N-a$N)*(c$minEw-a$minEw)-(b$minEw-a$minEw)*(c$N-a$N)<=0)h<-h[-length(h)]else break
  };h<-c(h,i)
}
hull<-lapply(cloud[h],function(p)list(N=p$N,Ew=p$minEw,grade=p$grade))
HN<-vapply(hull,`[[`,0,'N');HE<-vapply(hull,`[[`,0,'Ew')
matched<-lapply(0:48,function(N) {
  ix<-which(vapply(cloud,`[[`,0,'N')==N)
  best<-if(length(ix))list(grade=cloud[[ix]]$grade,Ew=cloud[[ix]]$minEw)else NULL
  # matchedDisclosure uses the UPPER/more-disclosing vertex weight, zero at a
  # vertex. This differs from ruleGap's separately documented lower weight.
  if(N%in%HN){j<-which(HN==N);return(list(N=N,H=HE[j],best=best,psi=0,lower=hull[[j]],upper=hull[[j]]))}
  lo<-max(which(HN<N));hi<-min(which(HN>N));psi<-(N-HN[lo])/(HN[hi]-HN[lo])
  list(N=N,H=(1-psi)*HE[lo]+psi*HE[hi],best=best,psi=psi,lower=hull[[lo]],upper=hull[[hi]])
})
slopes<-diff(HE)/diff(HN);limits<-c(0,slopes,.5);intervals<-list()
for(j in seq_along(hull)) {
  from<-max(0,limits[j]);to<-min(.5,limits[j+1L]);if(to<from)next
  p<-hull[[j]];ev<-evaluate(p$grade,ec,(from+to)/2,1)
  intervals[[length(intervals)+1L]]<-list(tauFrom=from,tauTo=to,grade=p$grade,N=p$N,Ew=p$Ew,
    G=ev$G,EoverN=ev$EoverN,riskFrom=evaluate(p$grade,ec,from,1)$risk,riskTo=evaluate(p$grade,ec,to,1)$risk)
}
ends<-sort(unique(vapply(intervals,`[[`,0,'tauTo')))
endpoints<-lapply(ends,function(tau)c(list(tau=tau),optC(tau)))
pathChanges<-if(length(intervals)>1L)lapply(2:length(intervals),function(j)change(intervals[[j-1L]]$grade,intervals[[j]]$grade,ec,1))else list()
nearBreaks<-lapply(slopes[slopes>0&slopes<.5],function(tau)lapply(c(tau-1e-10,tau,tau+1e-10),function(t)c(list(tau=t),optC(t))))
add('cde-complete-frontier','caseCdeFrontier',list(family=fc,tieTol=1e-12),
  list(family=list(size=nrow(GC)),inputLabels=vec(unlist(cde$tables$units$label)),posteriorMeanOrder=vec(oC-1L),
    cloud=lapply(cloud,function(p)p[c('N','minEw','maxEw','count')]),hull=hull,matched=matched,
    intervals=intervals,endpointOptima=endpoints,pathChanges=pathChanges,breakpointNeighbors=nearBreaks))
stopifnot(sum(vapply(cloud,`[[`,0,'count'))==523251L,is.null(matched[[31]]$best),matched[[47]]$psi>0,matched[[47]]$psi<1)
ix48<-which(NC==48L);stopifnot(length(ix48)==34650L)
lo<-floor(min(EC[ix48]));hi<-floor(max(EC[ix48]));bins<-lapply(lo:hi,function(a)list(from=a,to=a+1,count=sum(EC[ix48]>=a&EC[ix48]<a+1)))
orderedE<-sort(EC[ix48]);nextMin<-orderedE[which(orderedE>min(orderedE)+1e-12)[1L]]
add('cde-complete-N48','caseCdeN48',list(N=48L,family=fc,binWidth=1),
  list(N=48L,count=length(ix48),reports=lapply(ix48,function(i)list(grade=vec(GC[i,]),Ew=EC[i])),bins=bins,minEw=min(orderedE),nextMinEw=nextMin))
stopifnot(sum(vapply(bins,`[[`,0,'count'))==34650L)
topC<-function(tau,k=3L) {
  remain<-seq_len(nrow(GC));out<-list();key<-tau+(EC-tau*NC)/66
  for(j in seq_len(k)) {
    m<-min(key[remain]);i<-remain[which(key[remain]-m<=1e-12*(1+abs(m)))[1L]]
    ev<-evaluate(GC[i,],ec,tau,1);out[[j]]<-list(grade=vec(GC[i,]),risk=ev$risk,N=ev$N,Ew=ev$Ew);remain<-remain[remain!=i]
  };out
}
for(tau in c(.2,.45))add(paste0('cde-choice-tau',tau),'caseCdeChoice',list(tau=tau,family=fc,k=3L),list(optimum=optC(tau),matched=nrow(GC),reports=topC(tau)))
constraints<-list()
for(i in 1:12)for(j in 1:12)if(i!=j) {
  ix<-which(GC[,i]<GC[,j]);o<-optC(.2,ix,maxTies=length(ix));stopifnot(length(o$grades)==o$tieCount)
  constraints[[length(constraints)+1L]]<-c(list(stating=list(vec(c(i-1L,j-1L))),matched=length(ix),minimum=min((EC[ix]+.2*(66-NC[ix]))/66)),o)
}
add('cde-all-ordered-pair-constraints','caseCdeConstraints',list(tau=.2,family=fc),constraints);stopifnot(length(constraints)==132L)
cutReports<-list()
for(cuts in list(c(4L,8L),c(3L,9L),c(1L,2L),6L,11L)) {
  g<-integer(12);g[oC]<-1L+findInterval(0:11,cuts)
  cutReports[[length(cutReports)+1L]]<-list(cuts=vec(cuts),grade=vec(g),sizes=sizes(g),evaluation=evaluate(g,ec,.2,1),change=change(optC(.2)$grade,g,ec,1))
}
add('cde-cut-reports','caseCdeCutReports',list(tau=.2),list(order=vec(oC-1L),reports=cutReports))
ordC<-list(order=vec(oC-1L),blocks=vec(rep(1L,12)))
dpC<-orderDP(ec,1,.2,ordC,4L)
fOrderC<-list(kind='order',order=ordC$order,G=4L);allCutsC<-familyreports(12L,fOrderC)
enumeratedDP<-optimum(ec,.2,1,fOrderC,G=allCutsC)
stopifnot(nrow(allCutsC)==232L,identical(as.numeric(dpC$grade),as.numeric(enumeratedDP$grade)),
  dpC$tieCount==enumeratedDP$tieCount,abs(dpC$risk-enumeratedDP$risk)<1e-12)
add('cde-nonnested-families','caseCdeOrderComparison',list(tau=.2,orderCap=4L,enumerableCap=3L),
  list(orderOptimum=dpC,enumerableOptimum=optC(.2),comparison=compare(optC(.2)$grade,dpC$grade,ec,.2,1)))
pathTable<-cp$tables$path;pathGrade<-cp$arrays$grades$grade
archivePath<-lapply(seq_along(pathTable$tau),function(i) {
  tau<-num(pathTable$tau)[i];g<-num(pathGrade[[i]])
  list(index=i-1L,tau=tau,grade=vec(g),evaluation=evaluate(g,ec,tau,1),
    source=lapply(pathTable[c('tau_source','lower_bound','gap','status','bound_source','result_label')],function(v)v[[i]]))
})
add('cde-archived-path','caseCdeArchivedPath',list(),archivePath);stopifnot(length(archivePath)==13L)

# Alabama live families and fixed archived actions. These are conditional on
# each newly declared expected-rank order, not unrestricted certificates.
archiveA<-lapply(ala$tables$reports[setdiff(names(ala$tables$reports),'fips')],num)
for(w0 in c(0,.25,.5,.75,1)) {
  w<-c(w0,1-w0);ord<-rankOrder(ea,w,idsA);dp<-orderDP(ea,w,.2,ord,5L)
  agreement<-lapply(archiveA,function(g)identical(as.numeric(dp$grade),g))
  add(paste0('alabama-live-w',w0),'caseAlabamaLive',list(w=vec(w),tau=.2,cap=5L),
    list(expectedRank=ord$expectedRank,optimum=dp,archiveAgreement=agreement,
      archiveEvaluations=lapply(archiveA,function(g)list(grade=vec(g),evaluation=evaluate(g,ea,.2,w))),
      changeFromP=change(archiveA$P,dp$grade,ea,w)))
}
intervalColumns<-ala$tables$units[grep('^(mean|lower|upper)_',names(ala$tables$units))]
add('alabama-archive-commonality','caseAlabamaArchive',list(tau=.2,w=vec(c(.5,.5))),
  list(evaluations=lapply(archiveA,function(g)list(grade=vec(g),evaluation=evaluate(g,ea,.2,c(.5,.5)))),
    sourceCommonality=ala$tables$commonality,sourceSingleCriterion=ala$tables$single_criterion,
    sourceReferenceMetrics=ala$tables$reference_metrics,intervalLevel=ala$facts$interval_level,intervals=intervalColumns))

assert_no_postrank()
write_golden('oracle-v3p5-cases',rows,'r-export/46_v3_part5_cases.R',uses_postrank=FALSE)
path<-file.path(golden_dir,'oracle-v3p5-cases.json');m<-jsonlite::fromJSON(file.path(manifest_dir,'oracle-v3p5-cases.json'))
stopifnot(identical(m$sha256,sha256_file(path)),m$rows==length(rows),identical(m$uses_postrank,FALSE))
numbers<-function(x){if(is.list(x))return(unlist(lapply(x,numbers),use.names=FALSE));if(is.numeric(x))return(as.numeric(x[is.finite(x)]));numeric()}
written<-jsonlite::fromJSON(path,simplifyVector=FALSE)
stopifnot(identical(sort(numbers(rows)),sort(numbers(written$rows))))
assert_no_postrank()
cat('oracle-v3p5-cases:',length(rows),'rows;',length(numbers(rows)),'finite numbers exact17digit roundtrip;',
  'KRW202grid/DP97/CDE523251/N48=34650/132constraints/AlabamaDP67 independent base-R PASS.\n')
