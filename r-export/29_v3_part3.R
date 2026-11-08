# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R Phase 6 / Part 3 oracle.
# Sources: engine/API.md "Part 3 supplement"; public theory book chapters 16,17,19;
# released case-krw.json + krw-lambda-grid.json. No postrank/JavaScript/solver calls.
# The new decision.ts implementation, new tests and app numerical implementations were not read.
# Run: Rscript r-export/29_v3_part3.R (from repo root).
# Expected values are enumerations/indicator sums. Q1's polynomial coefficient convolution
# is cross-checked against explicit ordered compositions; allocation averages all complete
# boundary subsets; classification independently enumerates every binary action in small cases.
source('r-export/_paths.R'); source('r-export/_helpers.R'); source('r-export/_oracle.R')
assert_no_postrank()
vec <- function(x) I(unname(x))
Mof <- function(n) n*(n-1)/2
rows <- list()
add <- function(id,fn,args,expect) rows[[length(rows)+1L]] <<- list(id=id,args=c(list(fn=fn),args),expect=expect)
throws <- function(x) inherits(tryCatch({force(x);NULL},error=function(e)e),'error')
add_throw <- function(id,fn,args,expr) {stopifnot(throws(expr));add(id,paste0(fn,'Throws'),args,list(threw=TRUE))}
close <- function(a,b,tol=1e-12) stopifnot(length(a)==length(b),max(c(0,abs(a-b)))<tol)
known <- function(o,names) {if(!is.list(o)||length(setdiff(names(o),names)))stop('options');invisible(TRUE)}
integer_in <- function(x,lo,hi) length(x)==1L && is.finite(x) && x==floor(x) && x>=lo && x<=hi
valid_g <- function(g) {if(length(g)<2 || any(!is.finite(g)|g<1|g!=floor(g)))stop('grade');invisible(TRUE)}
weights <- function(w,K) {if(is.null(w))return(rep(1/K,K));if(length(w)!=K||any(!is.finite(w)|w<0)||abs(sum(w)-1)>1e-10)stop('weights');w}
earr <- function(e,ids=NULL,criteria=NULL) {
 if(length(dim(e))==2L)e<-array(e,c(nrow(e),ncol(e),1))
 list(ids=vec(if(is.null(ids))as.character(seq_len(dim(e)[1]))else ids),criteria=vec(if(is.null(criteria))paste0('c',seq_len(dim(e)[3]))else criteria),e=lapply(seq_len(dim(e)[3]),function(k)unname(e[,,k])))
}
weighted_e <- function(e,w=NULL) {
 if(length(dim(e))==2L)e<-array(e,c(nrow(e),ncol(e),1))
 n<-dim(e)[1];K<-dim(e)[3]
 if(n<2||dim(e)[2]!=n)stop('error shape')
 for(k in seq_len(K)) {x<-e[,,k];if(any(!is.finite(x[row(x)!=col(x)]))||any(x[row(x)!=col(x)]<0|x[row(x)!=col(x)]>1))stop('error value')}
 w<-weights(w,K);out<-matrix(0,n,n)
 for(k in seq_len(K)) {x<-e[,,k];diag(x)<-0;out<-out+w[k]*x};out
}
counts <- function(g,e) {
 valid_g(g); if(length(g)!=nrow(e))stop('length')
 above<-outer(g,g,'<');list(N=sum(above),Ew=sum(e[above]),M=Mof(length(g)))
}

# Q1: coefficients of (sum_{b>=1} x^b y^{choose(b,2)})^G, with no assignment weights.
composition_distribution <- function(n,G) {
 if(!integer_in(n,2,30)||!integer_in(G,1,n))stop('n/G')
 M<-Mof(n);a<-matrix(0,n+1,M+1);a[1,1]<-1
 for(h in seq_len(G)) {
  bnext<-matrix(0,n+1,M+1)
  for(b in seq_len(n)) {
   t<-Mof(b);if(t>M)next
   bnext[(b+1):(n+1),(t+1):(M+1)]<-bnext[(b+1):(n+1),(t+1):(M+1),drop=FALSE]+a[1:(n+1-b),1:(M+1-t),drop=FALSE]
  };a<-bnext
 }
 ct<-a[n+1,];ix<-which(ct>0);Ns<-M-(ix-1);o<-order(Ns);ix<-ix[o];Ns<-Ns[o]
 total<-sum(ct);stopifnot(total==choose(n-1,G-1),all(ct==floor(ct)))
 q<-n%/%G;r<-n%%G;bal<-c(rep(q+1L,r),rep(q,G-r));maxN<-M-sum(bal*(bal-1)/2)
 list(n=n,G=G,M=M,totalPatterns=total,distribution=lapply(seq_along(ix),function(k)list(N=Ns[k],withheld=ix[k]-1,count=ct[ix[k]],probability=ct[ix[k]]/total)),maxN=maxN,maxShare=maxN/M,balancedSizes=vec(bal))
}
compositions <- function(n,G) {
 if(G==1)return(matrix(n,1,1))
 do.call(rbind,lapply(seq_len(n-G+1),function(b)cbind(b,compositions(n-b,G-1))))
}
for(n in 2:9)for(G in seq_len(n)) {
 r<-composition_distribution(n,G);z<-compositions(n,G);N<-Mof(n)-rowSums(z*(z-1)/2);tab<-table(N)
 stopifnot(identical(as.numeric(names(tab)),vapply(r$distribution,`[[`,0,'N')),identical(as.numeric(tab),vapply(r$distribution,`[[`,0,'count')))
 add(sprintf('sizes-n%d-G%d',n,G),'tierSizeDistribution',list(n=n,G=G),r)
}
for(p in list(c(12,3),c(30,1),c(30,3),c(30,4),c(30,15),c(30,30))) {
 n<-p[1];G<-p[2];r<-composition_distribution(n,G)
 if(G<=4){z<-compositions(n,G);tab<-table(Mof(n)-rowSums(z*(z-1)/2));stopifnot(identical(as.numeric(tab),vapply(r$distribution,`[[`,0,'count')))}
 add(sprintf('sizes-n%d-G%d',n,G),'tierSizeDistribution',list(n=n,G=G),r)
}
for(p in list(c(1,1),c(31,3),c(3,0),c(3,4),c(3.5,2),c(3,1.5)))add_throw(paste0('sizes-invalid-',paste(p,collapse='-')),'tierSizeDistribution',list(n=p[1],G=p[2]),composition_distribution(p[1],p[2]))
for(s in list(c(10,10,10),c(1,1,28),c(8,7,8,7),c(4,4,4),c(5,4,3))) {
 g<-rep(seq_along(s),s);N<-sum(outer(g,g,'<'));M<-Mof(length(g))
 add(paste0('disclosure-sizes-',paste(s,collapse='-')),'disclosure',list(g=vec(g)),list(G=length(s),M=M,N=N,s=N/M,sizes=vec(s),withheld=M-N))
}

# Q2: scalar information uses the released one-criterion direction coefficients, no archive metric.
information <- function(g,e) {
 if(length(dim(e))==3L && dim(e)[3]!=1L)stop('one criterion required')
 eb<-weighted_e(e);q<-counts(g,eb);(q$N-2*q$Ew)/q$M
}
e2<-matrix(c(NA,.25,.75,NA),2,2,byrow=TRUE)
for(g in list(c(1,1),c(1,2),c(2,1)))add(paste0('information-small-',paste(g,collapse='')),'reportInformation',list(g=vec(g),E=earr(e2)),list(information=information(g,e2)))
e_tie<-matrix(c(NA,1,1,NA),2,2);add('information-weak-equality','reportInformation',list(g=vec(c(1,2)),E=earr(e_tie)),list(information=information(c(1,2),e_tie)))
add_throw('information-invalid-multicriterion','reportInformation',list(g=vec(c(1,2)),E=earr(array(rep(e2,2),c(2,2,2)))),information(c(1,2),array(rep(e2,2),c(2,2,2))))

# Q3: validity is membership in independently enumerated 13 canonical three-unit reports.
R3<-oracle_reports(3);R3<-R3[do.call(order,as.data.frame(R3)),,drop=FALSE]
valid_codes<-apply(R3,1,function(g)paste(sign(g[c(2,3,3)]-g[c(1,2,1)]),collapse=','))
stopifnot(length(unique(valid_codes))==13L)
threshold <- function(e,options=list(tau=.2,details=FALSE)) {
 known(options,c('tau','w','details'));tau<-options$tau
 if(length(tau)!=1L||!is.finite(tau)||tau<0||tau>.5)stop('tau')
 details<-if(is.null(options$details))FALSE else options$details
 if(length(details)!=1L||!is.logical(details)||is.na(details))stop('details')
 eb<-weighted_e(e,options$w);n<-nrow(eb);rel<-matrix(0L,n,n);pairs<-list()
 for(i in 1:(n-1))for(j in (i+1):n) {
  ab<-eb[i,j]<tau;ba<-eb[j,i]<tau;if(ab&&ba)stop('both directions')
  if(ab||ba) {a<-if(ab)i else j;b<-if(ab)j else i;rel[a,b]<-1L;rel[b,a]<- -1L;pairs[[length(pairs)+1L]]<-list(above=a-1L,below=b-1L,error=eb[a,b])}
 }
 bad<-list();inv<-0L;cnt<-list(twoWithheld=0L,statedChain=0L,directedCycle=0L);units<-integer(n);pin<-matrix(0L,n,n)
 if(n>=3)for(i in 1:(n-2))for(j in (i+1):(n-1))for(k in (j+1):n) {
  pattern<-c(rel[i,j],rel[j,k],rel[i,k]);if(paste(pattern,collapse=',')%in%valid_codes)next
  kind<-c('twoWithheld','statedChain','directedCycle')[sum(pattern!=0)]
  cnt[[kind]]<-cnt[[kind]]+1L;inv<-inv+1L;if(details)bad[[length(bad)+1L]]<-list(i=i-1L,j=j-1L,k=k-1L,kind=kind)
  units[c(i,j,k)]<-units[c(i,j,k)]+1L
  for(p in list(c(i,j),c(i,k),c(j,k))){pin[p[1],p[2]]<-pin[p[1],p[2]]+1L;pin[p[2],p[1]]<-pin[p[2],p[1]]+1L}
 }
 stopifnot(sum(unlist(cnt))==inv,sum(units)==3*inv,sum(pin)==6*inv)
 list(n=n,M=Mof(n),tau=tau,relation=unname(rel),statedPairs=pairs,statedCount=length(pairs),triples=choose(n,3),invalidCount=inv,counts=cnt,printable=inv==0L,unitIncidence=vec(units),pairIncidence=unname(pin),violations=if(details)bad else NULL)
}
pattern_e <- function(p,tau=.2) {
 e<-matrix(.5,3,3);diag(e)<-NA
 for(h in 1:3){ij<-list(c(1,2),c(2,3),c(1,3))[[h]];v<-p[h];if(v!=0){e[ij[1],ij[2]]<-if(v==1)tau/2 else 1-tau/2;e[ij[2],ij[1]]<-1-e[ij[1],ij[2]]}}
 e
}
patterns<-as.matrix(expand.grid(rep(list(-1:1),3)));types<-integer(4)
for(h in seq_len(nrow(patterns))) {
 p<-patterns[h,];r<-threshold(pattern_e(p),list(tau=.2,details=TRUE));types<-types+c(r$printable,r$counts$twoWithheld,r$counts$statedChain,r$counts$directedCycle)
 add(sprintf('threshold-pattern-%02d',h),'thresholdViolations',list(pattern=vec(p),options=list(tau=.2,details=TRUE)),r)
}
stopifnot(identical(types,c(13L,6L,6L,2L)))
for(t in c(0,.2,.5)) {e<-matrix(.5,3,3);diag(e)<-NA;add(paste0('threshold-equality-tau',t),'thresholdViolations',list(E=earr(e),options=list(tau=t,details=TRUE)),threshold(e,list(tau=t,details=TRUE)))}
e_eq<-matrix(c(NA,.2,.8,NA),2,2);add('threshold-strict-equals-tau','thresholdViolations',list(E=earr(e_eq),options=list(tau=.2,details=TRUE)),threshold(e_eq,list(tau=.2,details=TRUE)))
e_both<-matrix(c(NA,.1,.1,NA),2,2);add_throw('threshold-both-directions','thresholdViolations',list(E=earr(e_both),options=list(tau=.2)),threshold(e_both,list(tau=.2)))
for(t in c(-.01,.51))add_throw(paste0('threshold-invalid-tau',t),'thresholdViolations',list(E=earr(e2),options=list(tau=t)),threshold(e2,list(tau=t)))
add_throw('threshold-unknown-option','thresholdViolations',list(E=earr(e2),options=list(tau=.2,bogus=TRUE)),threshold(e2,list(tau=.2,bogus=TRUE)))
e_weighted<-array(c(pattern_e(c(1,1,0)),pattern_e(c(-1,-1,0))),c(3,3,2))
for(w in list(c(1,0),c(.5,.5),c(.25,.75)))add(paste0('threshold-weighted-',paste(w,collapse='-')),'thresholdViolations',list(E=earr(e_weighted),options=list(tau=.2,w=vec(w),details=TRUE)),threshold(e_weighted,list(tau=.2,w=w,details=TRUE)))

# Q4: fixed whole reports; weak wrong-direction indicators are accumulated within each whole state.
loss_compare <- function(gBest,gRule,states,options) {
 known(options,c('tau','w','tieTol'));valid_g(gBest);valid_g(gRule)
 if(length(gBest)!=length(gRule)||!length(states))stop('shape')
 tau<-options$tau;if(length(tau)!=1||!is.finite(tau)||tau<=0||tau>.5)stop('tau')
 tie<-if(is.null(options$tieTol))1e-12 else options$tieTol;if(length(tie)!=1||!is.finite(tie)||tie<0)stop('tieTol')
 n<-length(gBest);M<-Mof(n);K<-ncol(states[[1]]);w<-weights(options$w,K)
 one<-function(g,s){if(!identical(dim(s),c(n,K))||any(!is.finite(s)))stop('state');N<-0;D<-rep(0,K)
  for(i in 1:(n-1))for(j in (i+1):n)if(g[i]!=g[j]){N<-N+1;above<-if(g[i]<g[j])i else j;below<-if(g[i]<g[j])j else i;for(k in seq_len(K))D[k]<-D[k]+as.numeric(s[above,k]<=s[below,k])}
  (sum(w*D)+tau*(M-N))/M}
 a<-vapply(states,function(s)one(gBest,s),0);b<-vapply(states,function(s)one(gRule,s),0);d<-b-a;S<-length(states);rw<-sum(d< -tie);bw<-sum(d>tie);ties<-S-rw-bw
 list(lossBest=vec(a),lossRule=vec(b),delta=vec(d),meanBest=mean(a),meanRule=mean(b),meanDelta=mean(d),mcseDelta=if(S==1)NULL else sd(d)/sqrt(S),ruleWins=rw,bestWins=bw,ties=ties,ruleWinShare=rw/S,bestWinShare=bw/S,tieShare=ties/S,S=S,tieTol=tie)
}
draw_json <- function(states,flat=TRUE) if(!length(states))list()else if(flat&&ncol(states[[1]])==1)lapply(states,function(s)vec(s[,1]))else lapply(states,unname)
lossrow <- function(id,gb,gr,states,options,flat=TRUE) {r<-loss_compare(gb,gr,states,options);add(id,'compareReportLosses',list(gBest=vec(gb),gRule=vec(gr),draws=draw_json(states,flat),options=options),r);invisible(r)}
st10<-c(rep(list(matrix(c(20,4,3),3,1)),3),rep(list(matrix(c(0,4,3),3,1)),7))
lr<-lossrow('loss-tb19-ten-equal-states',c(2,1,2),c(1,1,2),st10,list(tau=.25));close(lr$meanDelta,2/15)
lossrow('loss-tb19-identical',c(2,1,2),c(2,1,2),st10,list(tau=.25))
lossrow('loss-all-withheld',c(1,1,1),c(1,2,3),st10,list(tau=.25))
lossrow('loss-one-draw-weak-equality',c(1,2),c(1,1),list(matrix(c(4,4),2,1)),list(tau=.2))
lossrow('loss-two-draw-decision-tolerance',c(1,1),c(1,2),list(matrix(c(2,1),2,1),matrix(c(1,2),2,1)),list(tau=.5,tieTol=.5))
counter<-lossrow('loss-finite-mean-counter-sign',c(1,1),c(2,1),rep(list(matrix(c(0,4),2,1)),4),list(tau=.25));stopifnot(counter$meanDelta<0)
st2<-list(cbind(c(2,1,0),c(0,1,2)),cbind(c(1,1,0),c(2,0,1)),cbind(c(0,2,1),c(2,1,0)))
lossrow('loss-multicriterion-weak-ties',c(1,2,3),c(2,1,2),st2,list(tau=.2,w=vec(c(.25,.75))),FALSE)
add_throw('loss-invalid-unknown-option','compareReportLosses',list(gBest=vec(c(1,1)),gRule=vec(c(1,2)),draws=list(vec(c(1,0))),options=list(tau=.2,probs=vec(1))),loss_compare(c(1,1),c(1,2),list(matrix(c(1,0),2,1)),list(tau=.2,probs=1)))

# Q5: one unordered pair once, denominator all M; monotone grade relabeling changes no relation.
change <- function(g0,g1) {
 valid_g(g0);valid_g(g1);if(length(g0)!=length(g1))stop('length')
 n<-length(g0);M<-Mof(n);cnt<-c(0L,0L,0L,0L);p<-list();nm<-c('below','withheld','above')
 for(i in 1:(n-1))for(j in (i+1):n){a<-sign(g0[j]-g0[i]);b<-sign(g1[j]-g1[i]);k<-if(a==b)1L else if(a==0)2L else if(b==0)3L else 4L;cnt[k]<-cnt[k]+1L
  if(k!=1L)p[[length(p)+1L]]<-list(i=i-1L,j=j-1L,from=nm[a+2],to=nm[b+2],error=NULL)}
 ch<-sum(cnt[-1]);list(M=M,nSame=cnt[1],nNewDisclosed=cnt[2],nNewWithheld=cnt[3],nReversed=cnt[4],agreement=cnt[1]/M,pairs=p,changed=ch,changeShare=ch/M)
}
for(p in list(list(c(1,1,2),c(1,2,2)),list(c(1,1,1),c(1,1,1)),list(c(1,2,3),c(3,2,1)),list(c(1,1,1),c(1,2,3)),list(c(1,2,3),c(1,1,1)),list(c(1,1,2,3),c(2,2,5,8))))add(paste0('change-',paste(p[[1]],collapse=''),'-',paste(p[[2]],collapse='')),'relationChange',list(g0=vec(p[[1]]),g1=vec(p[[2]])),change(p[[1]],p[[2]]))

# Q6: enumerate all complete boundary subsets, not the marginal r/m formula for expectations.
allocation <- function(g,options) {
 known(options,c('values','pTop','budget'));valid_g(g);n<-length(g);b<-options$budget;v<-options$values;p<-options$pTop
 if(!integer_in(b,0,n)||length(v)!=n||length(p)!=n||any(!is.finite(v))||any(!is.finite(p)|p<0|p>1)||abs(sum(p)-b)>1e-10*max(1,n))stop('allocation inputs')
 if(b==0)return(list(inclusion=vec(rep(0,n)),expectedValue=0,expectedOverlap=0,overlapShare=NULL,selectedCount=0,budget=0,boundaryGrade=NULL,boundaryMembers=vec(integer()),boundarySize=0,remaining=0,aboveCount=0))
 grades<-sort(unique(g));cumulative<-cumsum(vapply(grades,function(h)sum(g==h),0));h<-grades[which(cumulative>=b)[1]];above<-which(g<h);members<-which(g==h);r<-b-length(above)
 sets<-if(r==length(members))matrix(members,length(members),1)else combn(members,r)
 q<-rep(0,n);ev<-ov<-numeric(ncol(sets))
 for(j in seq_len(ncol(sets))){S<-c(above,sets[,j]);stopifnot(length(S)==b,length(unique(S))==b);q[S]<-q[S]+1;ev[j]<-sum(v[S]);ov[j]<-sum(p[S])}
 q<-q/ncol(sets);close(sum(q),b);close(mean(ev),sum(q*v));close(mean(ov),sum(q*p))
 list(inclusion=vec(q),expectedValue=mean(ev),expectedOverlap=mean(ov),overlapShare=mean(ov)/b,selectedCount=sum(q),budget=b,boundaryGrade=h,boundaryMembers=vec(members-1L),boundarySize=length(members),remaining=r,aboveCount=length(above))
}
allocrow <- function(id,g,v,p,b) {o<-list(values=vec(v),pTop=vec(p),budget=b);r<-allocation(g,o);add(id,'allocationValue',list(g=vec(g),options=o),r);invisible(r)}
for(g in list(c(1,1),c(1,2),c(2,1)))allocrow(paste0('allocation-tb17-',paste(g,collapse='')),g,c(6,4),c(.3,.7),1)
# Top-b scores are recomputed under an exact-cardinality target for each b.
for(b in 0:3) {
 p<-if(b==0)c(0,0,0)else if(b==1)c(.3,.7,0)else if(b==2)c(.3,1,.7)else c(1,1,1)
 for(g in list(c(1,1,1),c(1,1,2),c(2,1,2),c(1,2,3),c(3,1,2)))allocrow(sprintf('allocation-tb19-b%d-g%s',b,paste(g,collapse='')),g,c(6,4,3),p,b)
}
allocrow('allocation-negative-utilities-whole-boundary',c(1,1,2,3),c(-4,-2,1,3),c(.2,.4,.5,.9),2)
allocrow('allocation-partial-middle-boundary',c(1,2,2,2,3),c(5,-3,2,8,0),c(.9,.1,.5,.5,0),2)
# Exhaustive small coherent reports, all budgets, independently validate native subset optima.
for(gidx in seq_len(nrow(R3)))for(b in 0:3) {
 g<-R3[gidx,];p<-list(c(0,0,0),c(.3,.7,0),c(.3,1,.7),c(1,1,1))[[b+1]];v<-c(6,4,3);r<-allocation(g,list(values=v,pTop=p,budget=b))
 allsets<-if(b==0)matrix(integer(),0,1)else combn(3,b);bestV<-bestP<- -Inf
 for(k in seq_len(ncol(allsets))){bestV<-max(bestV,sum(v[allsets[,k]]));bestP<-max(bestP,sum(p[allsets[,k]]))}
 stopifnot(r$expectedValue<=bestV+1e-12,r$expectedOverlap<=bestP+1e-12)
}
add_throw('allocation-invalid-top-cardinality','allocationValue',list(g=vec(c(1,1,2)),options=list(values=vec(c(5,5,0)),pTop=vec(c(1,1,0)),budget=1)),allocation(c(1,1,2),list(values=c(5,5,0),pTop=c(1,1,0),budget=1)))
add_throw('allocation-invalid-budget','allocationValue',list(g=vec(c(1,2)),options=list(values=vec(c(1,2)),pTop=vec(c(.5,.5)),budget=1.5)),allocation(c(1,2),list(values=c(1,2),pTop=c(.5,.5),budget=1.5)))
add_throw('allocation-invalid-unknown-option','allocationValue',list(g=vec(c(1,2)),options=list(values=vec(c(1,2)),pTop=vec(c(.5,.5)),budget=1,seed=1)),allocation(c(1,2),list(values=c(1,2),pTop=c(.5,.5),budget=1,seed=1)))

# Q7: direct Bernoulli costs, with an independent exhaustive 2^n binary-action check.
classification <- function(p,options) {
 known(options,c('falsePositiveCost','falseNegativeCost','positive'));fp<-options$falsePositiveCost;fn<-options$falseNegativeCost;n<-length(p)
 if(!n||any(!is.finite(p)|p<0|p>1)||length(fp)!=1||length(fn)!=1||!is.finite(fp)||!is.finite(fn)||fp<0||fn<0||!is.finite(fp+fn)||fp+fn<=0)stop('classification inputs')
 cut<-fp/(fp+fn);pc<-fp*(1-p);nc<-fn*p;bayes<-p>=cut
 pos<-if(is.null(options$positive))bayes else options$positive
 pos<-unclass(pos);if(length(pos)!=n||anyNA(pos)||any(!(pos%in%c(0,1))))stop('positive');pos<-as.logical(pos)
 efp<-sum((1-p)[pos]);efn<-sum(p[!pos]);total<-fp*efp+fn*efn
 actions<-as.matrix(expand.grid(rep(list(c(FALSE,TRUE)),n)));allcost<-apply(actions,1,function(a)sum(ifelse(a,pc,nc)))
 close(min(allcost),sum(ifelse(bayes,pc,nc)))
 if(is.null(options$positive))close(total,min(allcost))
 list(positive=vec(pos),bayesPositive=vec(bayes),positiveCount=sum(pos),cutoff=cut,positiveCost=vec(pc),negativeCost=vec(nc),expectedFalsePositives=efp,expectedFalseNegatives=efn,totalCost=total,meanCost=total/n)
}
classrow <- function(id,p,fp,fn,pos=NULL) {o<-list(falsePositiveCost=fp,falseNegativeCost=fn);if(!is.null(pos))o$positive<-vec(pos);r<-classification(p,o);add(id,'thresholdClassification',list(probabilities=vec(p),options=o),r);invisible(r)}
# v computed from the substantive strict event on the source states, not the decision cutoff.
statevals<-rbind(c(20,4,3),c(0,4,3));mass<-c(.3,.7)
for(t in c(3.5,4)) {
 p<-colSums((statevals>t)*mass)
 classrow(paste0('classification-tb19-level',t,'-equal'),p,1,1)
 classrow(paste0('classification-tb19-level',t,'-asymmetric'),p,1,3)
 classrow(paste0('classification-tb19-level',t,'-B-only'),p,1,3,c(FALSE,TRUE,FALSE))
}
for(cost in list(c(1,1),c(1,3),c(3,1),c(0,1),c(1,0))) {
 p<-c(0,.25,.5,.75,1);fp<-cost[1];fn<-cost[2];stem<-paste0('classification-grid-cost',fp,'-',fn)
 classrow(stem,p,fp,fn);classrow(paste0(stem,'-none'),p,fp,fn,rep(FALSE,5));classrow(paste0(stem,'-all'),p,fp,fn,rep(TRUE,5))
}
classrow('classification-single-equality',.5,1,1)
classrow('classification-normal-events',pnorm(c(-2,0,2)),2,1)
for(pos in list(c(0,0,0),c(1,0,1),c(TRUE,FALSE,TRUE)))classrow(paste0('classification-explicit-',if(is.logical(pos))'boolean-'else'numeric-',paste(as.integer(pos),collapse='')),c(.2,.5,.8),1,1,pos)
add_throw('classification-both-costs-zero','thresholdClassification',list(probabilities=vec(c(.2,.8)),options=list(falsePositiveCost=0,falseNegativeCost=0)),classification(c(.2,.8),list(falsePositiveCost=0,falseNegativeCost=0)))
add_throw('classification-invalid-probability','thresholdClassification',list(probabilities=vec(c(-.1,.8)),options=list(falsePositiveCost=1,falseNegativeCost=1)),classification(c(-.1,.8),list(falsePositiveCost=1,falseNegativeCost=1)))
add_throw('classification-invalid-flags','thresholdClassification',list(probabilities=vec(c(.2,.8)),options=list(falsePositiveCost=1,falseNegativeCost=1,positive=vec(c(0,.5)))),classification(c(.2,.8),list(falsePositiveCost=1,falseNegativeCost=1,positive=c(0,.5))))
add_throw('classification-unknown-option','thresholdClassification',list(probabilities=vec(c(.2,.8)),options=list(falsePositiveCost=1,falseNegativeCost=1,budget=1)),classification(c(.2,.8),list(falsePositiveCost=1,falseNegativeCost=1,budget=1)))

# Further input/edge contracts, derived without examining implementation errors.
add_throw('information-invalid-report-length','reportInformation',list(g=vec(c(1,2,3)),E=earr(e2)),information(c(1,2,3),e2))
add_throw('threshold-invalid-details-type','thresholdViolations',list(E=earr(e2),options=list(tau=.2,details=1)),threshold(e2,list(tau=.2,details=1)))
for(spec in list(list(id='empty',states=list(),o=list(tau=.2)),list(id='zero-tau',states=list(matrix(c(1,0),2,1)),o=list(tau=0)),list(id='negative-tolerance',states=list(matrix(c(1,0),2,1)),o=list(tau=.2,tieTol=-1))))add_throw(paste0('loss-invalid-',spec$id),'compareReportLosses',list(gBest=vec(c(1,1)),gRule=vec(c(1,2)),draws=draw_json(spec$states),options=spec$o),loss_compare(c(1,1),c(1,2),spec$states,spec$o))
allocrow('allocation-two-of-four-boundary',c(1,2,2,2,2,3),c(8,-2,3,5,1,0),c(1,.2,.8,.5,.5,0),3)
add_throw('classification-empty','thresholdClassification',list(probabilities=vec(numeric()),options=list(falsePositiveCost=1,falseNegativeCost=1)),classification(numeric(),list(falsePositiveCost=1,falseNegativeCost=1)))
add_throw('classification-negative-cost','thresholdClassification',list(probabilities=vec(c(.2,.8)),options=list(falsePositiveCost=-1,falseNegativeCost=1)),classification(c(.2,.8),list(falsePositiveCost=-1,falseNegativeCost=1)))
add_throw('classification-overflow-cost-sum','thresholdClassification',list(probabilities=vec(c(.2,.8)),options=list(falsePositiveCost=1e308,falseNegativeCost=1e308)),classification(c(.2,.8),list(falsePositiveCost=1e308,falseNegativeCost=1e308)))
assert_no_postrank()
# UI pins below are built only from released inputs and the independent functions above.
krw <- jsonlite::fromJSON(file.path(released_dir,'case-krw.json'),simplifyVector=FALSE)
grid <- jsonlite::fromJSON(file.path(released_dir,'krw-lambda-grid.json'),simplifyVector=FALSE)
ids <- unlist(krw$arrays$error$ids);nkrw<-length(ids)
stopifnot(nkrw==97L,identical(ids,unlist(krw$tables$units$id)),identical(ids,unlist(krw$tables$reports$id)),identical(ids,unlist(grid$tables$firms$id)),identical(unlist(krw$arrays$error$criteria),c('race_signed','gender_signed')))
read_matrix <- function(a) t(vapply(a,function(r)vapply(r,function(v)if(is.null(v))NA_real_ else as.numeric(v),0),numeric(length(a))))
EK <- list(race=read_matrix(krw$arrays$error$e[[1]]),gender=read_matrix(krw$arrays$error$e[[2]]))
lambdas<-unlist(grid$facts$lambda)
stopifnot(length(lambdas)==101L,max(abs(lambdas-(0:100)/100))<1e-14)
card <- function(criterion,lambda) {j<-which(abs(lambdas-lambda)<1e-12);stopifnot(length(j)==1L);as.integer(unlist(grid$arrays[[criterion]]$grade[[j]]))}
for(c in names(EK)) {
 stopifnot(identical(card(c,.25),as.integer(unlist(krw$tables$reports[[paste0(c,'_card')]]))))
 e<-EK[[c]];stopifnot(all(dim(e)==c(nkrw,nkrw)),max(abs(e+t(e)-1),na.rm=TRUE)<1e-13)
}
# Quantile positions and exact-score tie blocks: merge every raw tier crossed by a tie.
tiers <- function(scores,G) {
 n<-length(scores);ord<-order(-scores,seq_len(n));v<-scores[ord];initial<-1L+floor((seq_len(n)-1)*G/n)
 joins<-matrix(FALSE,G,G);diag(joins)<-TRUE
 for(value in unique(v)){gs<-unique(initial[v==value]);joins[gs,gs]<-TRUE}
 # Connected components of raw tiers are the transitive merge, independently of unit order.
 changed<-TRUE
 while(changed){old<-joins;joins<-(joins%*%joins)>0;changed<-!identical(old,joins)}
 component<-vapply(seq_len(G),function(k)min(which(joins[k,])),0);lab<-match(component[initial],unique(component[initial]));out<-integer(n);out[ord]<-lab;out
}
metrics <- function(g,e) {
 q<-counts(g,e);sz<-tabulate(match(g,sort(unique(g))));I<-(q$N-2*q$Ew)/q$M
 # Second independent identity: information is the sum of 1-2e for every stated direction.
 close(I,sum((1-2*e)[outer(g,g,'<')])/q$M,1e-12)
 list(grade=vec(g),sizes=vec(sz),M=q$M,N=q$N,DR=q$Ew/q$M,information=I,Ew=q$Ew,EoverN=if(q$N)q$Ew/q$N else NULL)
}
qmetrics <- list()
for(c in names(EK))for(G in c(4L,10L)) {
 scores<-as.numeric(unlist(krw$tables$units[[paste0('mean_',c)]]));g<-tiers(scores,G);r<-metrics(g,EK[[c]]);qmetrics[[paste(c,G,sep='-')]]<-r
 add(sprintf('krw-%s-quantile-G%d',c,G),'krwQuantile',list(criterion=c,G=G),r)
 add(sprintf('information-krw-%s-quantile-G%d',c,G),'reportInformation',list(criterion=c,g=vec(g)),list(information=information(g,EK[[c]])))
}
for(c in names(EK))for(lambda in if(c=='race')c(.1,.25,.5,.6,.75,.82)else c(.25,.64,.8)) {
 g<-card(c,lambda);r<-metrics(g,EK[[c]])
 add(sprintf('krw-%s-card-lambda%.2f',c,lambda),'krwCard',list(criterion=c,lambda=lambda),r)
}
# Select (do not re-optimize) the first released grid report that dominates the gender decile
# in the declared released-law DR/information axes, if one exists.
base<-qmetrics[['gender-10']];grid_metrics<-lapply(seq_along(lambdas),function(j)metrics(card('gender',lambdas[j]),EK$gender))
dom<-which(vapply(grid_metrics,function(q)q$DR<base$DR && q$information>base$information,TRUE))
stopifnot(length(dom)>0)
dj<-dom[1];dom_lambda<-lambdas[dj]
add('krw-gender-decile-grid-dominator','krwCard',list(criterion='gender',lambda=dom_lambda),grid_metrics[[dj]])
cat('Gender decile first strict released-grid dominator: lambda',dom_lambda,'DR',grid_metrics[[dj]]$DR,'information',grid_metrics[[dj]]$information,'\n')
# Strict threshold diagnostics on the same declared released law. Full 97-unit locations,
# pair directions and incidences are retained; no invalid-triple list is allocated in count mode.
for(c in names(EK))for(lambda in if(c=='race')c(0,.1,.25,.5,.75)else c(.25,1)) {
 tau<-lambda/(1+lambda);r<-threshold(EK[[c]],list(tau=tau,details=FALSE))
 add(sprintf('threshold-krw-%s-lambda%.2f',c,lambda),'thresholdViolations',list(criterion=c,lambda=lambda,options=list(tau=tau,details=FALSE)),r)
 cat('KRW threshold',c,'lambda',lambda,'tau',tau,'stated',r$statedCount,'invalid',r$invalidCount,'types',paste(unlist(r$counts),collapse='/'),'\n')
}

# 3.6: independent lower envelopes from all affine pair-count losses. Source ch.19 law.
states19<-rbind(c(20,4,3),c(0,4,3));mass19<-c(.3,.7);e19<-matrix(NA_real_,3,3)
for(i in 1:3)for(j in 1:3)if(i!=j)e19[i,j]<-sum(mass19[states19[,i]<=states19[,j]])
close(colSums(states19*mass19),c(6,4,3));close(1+rowSums(e19,na.rm=TRUE),c(2.4,1.3,2.3))
# An action's supported interval solves every inequality E_g-tau*N_g <= E_h-tau*N_h.
# Equal (N,E) actions are represented by the lexicographically smallest grade; isolated
# interior equality actions are not intervals. The endpointOptima list records exact ties.
law_path <- function(order0,G,family) {
 gg<-R3[apply(R3,1,max)<=G,,drop=FALSE]
 if(family=='all')gg<-R3
 if(family=='order') {
  ord<-order0+1L;gg<-gg[apply(gg[,ord,drop=FALSE],1,function(g)all(diff(g)>=0)),,drop=FALSE]
 }
 ev<-lapply(seq_len(nrow(gg)),function(j)counts(gg[j,],e19));Ns<-vapply(ev,`[[`,0,'N');Es<-vapply(ev,`[[`,0,'Ew')
 # Exactly one minimum-E action at each N, with canonical lexicographic ties.
 ix<-integer();for(N in sort(unique(Ns))){at<-which(Ns==N);ix<-c(ix,at[which.min(Es[at])])}
 gg<-gg[ix,,drop=FALSE];Ns<-Ns[ix];Es<-Es[ix];out<-list();isolated<-list()
 for(j in seq_along(Ns)) {
  lo<-0;hi<-.5;ok<-TRUE
  for(k in seq_along(Ns))if(k!=j){dn<-Ns[j]-Ns[k];de<-Es[j]-Es[k]
   if(dn==0){if(de>0)ok<-FALSE}else if(dn>0)lo<-max(lo,de/dn)else hi<-min(hi,de/dn)}
  if(!ok||hi<lo-1e-12)next
  rec<-list(tauFrom=lo,tauTo=hi,grade=vec(gg[j,]),N=Ns[j],Ew=Es[j],riskFrom=(Es[j]+lo*(3-Ns[j]))/3,riskTo=(Es[j]+hi*(3-Ns[j]))/3)
  if(hi>lo+1e-12)out[[length(out)+1L]]<-rec else if(abs(lo-.5)<1e-12)out[[length(out)+1L]]<-rec else if(lo>0&&lo<.5)isolated[[length(isolated)+1L]]<-rec
 }
 stopifnot(length(out)>0,length(isolated)==0L)
 out<-out[order(vapply(out,`[[`,0,'tauFrom'),vapply(out,`[[`,0,'tauTo'))]
 # Check interval midpoints against every feasible report, not just the per-N minima.
 for(q in out)if(q$tauTo>q$tauFrom){t<-(q$tauFrom+q$tauTo)/2;allE<-vapply(ev,`[[`,0,'Ew');allN<-vapply(ev,`[[`,0,'N');close(q$Ew-t*q$N,min(allE-t*allN))}
 list(intervals=out)
}
for(G in 1:3) {
 for(ord in list(c(0L,1L,2L),c(1L,2L,0L))) {
  r<-law_path(ord,G,'order');add(sprintf('tb19-lawpath-%s-cap%d',if(ord[1]==0)'mean'else'rank',G),'lawPath',list(law='tb19',order=vec(ord),G=G,family='order'),r)
 }
 add(sprintf('tb19-lawpath-unrestricted-cap%d',G),'lawPath',list(law='tb19',order=NULL,G=G,family='cap'),law_path(NULL,G,'cap'))
}
add('tb19-lawpath-all','lawPath',list(law='tb19',order=NULL,G=3L,family='all'),law_path(NULL,3,'all'))

# 3.13 supplied-law/book pins: exact reporting risks + top-b target/event inputs are retained
# under a separate composition tag so adapters use public law/report/allocation operations.
book_eval <- function(g,tau,budget) {
 pTop<-if(budget==0)c(0,0,0)else if(budget==1)c(.3,.7,0)else if(budget==2)c(.3,1,.7)else c(1,1,1)
 q<-counts(g,e19);list(grade=vec(g),M=q$M,N=q$N,Ew=q$Ew,risk=(q$Ew+tau*(q$M-q$N))/q$M,EoverN=if(q$N)q$Ew/q$N else NULL,means=vec(colSums(states19*mass19)),pTop=vec(pTop),allocation=allocation(g,list(values=colSums(states19*mass19),pTop=pTop,budget=budget)))
}
for(g in list(c(1,1,1),c(1,1,2),c(2,1,2),c(3,1,2),c(1,2,3)))add(paste0('book-tb19-report-',paste(g,collapse='')),'bookEvaluation',list(law='tb19',g=vec(g),tau=.25,budget=1L),book_eval(g,.25,1))
assert_no_postrank()
stopifnot(!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3p3',rows,'r-export/29_v3_part3.R',uses_postrank=FALSE)
cat('oracle-v3p3:',length(rows),'rows; helper functions and released UI pins generated without postrank/JS.\n')
