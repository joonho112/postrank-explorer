# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R native decision experiment (3.13), written before reading the app.
# Sources: public theory book ch.17/19, engine/API.md contracts/SR-06, _rng.R's independent
# public stream implementation. No new app source, decision.ts or new test expectations read.
# The fixed league measurement uses measurementSeed=20261030; seed=1 is a DISTINCT
# posterior Monte Carlo stream. No restart of the measurement-noise stream is used here.
# No postrank/JavaScript/solver calls or downloads. Run from repository root.
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');source('r-export/_rng.R')
assert_no_postrank()
vec<-function(x)I(unname(x));Mof<-function(n)n*(n-1)/2
rows<-list();diagnostics<-list()
add<-function(id,args,expect)rows[[length(rows)+1L]]<<-list(id=id,args=c(list(fn='nativeDecisionExperiment'),args),expect=expect)
close<-function(a,b,tol=1e-12)stopifnot(length(a)==length(b),all(is.na(a)==is.na(b)),max(c(0,abs(a-b)),na.rm=TRUE)<tol)
strict_order<-function(s){g<-integer(length(s));g[order(-s,seq_along(s))]<-seq_along(s);g}
lexsort<-function(G)G[do.call(order,as.data.frame(G)),,drop=FALSE]
evaluation<-function(g,e,tau){M<-Mof(length(g));st<-outer(g,g,'<');N<-sum(st);E<-sum(e[st]);list(M=M,N=N,Ew=E,EoverN=if(N)E/N else NULL,risk=(E+tau*(M-N))/M,disclosure=N/M)}
normal_e<-function(m,s){n<-length(m);e<-matrix(NA_real_,n,n);for(i in seq_len(n))for(j in seq_len(n))if(i!=j)e[i,j]<-pnorm((m[j]-m[i])/sqrt(s[i]^2+s[j]^2));e}
finite_e<-function(states,p){n<-ncol(states);e<-matrix(NA_real_,n,n);for(i in seq_len(n))for(j in seq_len(n))if(i!=j)e[i,j]<-sum(p[states[,i]<=states[,j]]);e}
top_prob<-function(states,p,b){n<-ncol(states);if(b==0)return(rep(0,n));selected<-matrix(FALSE,nrow(states),n)
 for(s in seq_len(nrow(states))){o<-order(-states[s,],seq_len(n));target<-o[seq_len(b)];stopifnot(length(unique(target))==b);selected[s,target]<-TRUE}
 stopifnot(all(rowSums(selected)==b))
 # Equal-weight MC is an integer membership count divided once by S; finite laws
 # retain their declared masses rather than being treated as equally likely states.
 out<-if(all(p==1/nrow(states)))colSums(selected)/nrow(states)else drop(crossprod(p,selected))
 close(sum(out),b,1e-10);out}
# Complete budget-sized subsets, used for boundary lotteries and the native utility maxima.
subsets_cache<-new.env(parent=emptyenv())
subsets<-function(n,b){key<-paste(n,b,sep=':');if(exists(key,subsets_cache,inherits=FALSE))return(get(key,subsets_cache))
 z<-if(b==0)matrix(integer(),0,1)else combn(n,b);stopifnot(ncol(z)==choose(n,b));assign(key,z,subsets_cache);z}
allocation<-function(g,values,pTop,budget){n<-length(g);b<-budget;stopifnot(length(values)==n,length(pTop)==n,all(is.finite(values)),all(pTop>=0 & pTop<=1),abs(sum(pTop)-b)<1e-10*max(1,n),b>=0,b<=n,b==floor(b))
 if(b==0)return(list(inclusion=vec(rep(0,n)),expectedValue=0,expectedOverlap=0,overlapShare=NULL,selectedCount=0,budget=0,boundaryGrade=NULL,boundaryMembers=vec(integer()),boundarySize=0,remaining=0,aboveCount=0))
 gr<-sort(unique(g));sz<-vapply(gr,function(h)sum(g==h),0);h<-gr[which(cumsum(sz)>=b)[1]];above<-which(g<h);members<-which(g==h);r<-b-length(above)
 local<-subsets(length(members),r);sets<-matrix(members[local],nrow=r);L<-ncol(sets)
 # Average whole sets, preserving exact budget/cardinality in every realization.
 stopifnot(all(apply(sets,2,function(v)length(unique(c(above,v))))==b))
 q<-numeric(n);q[above]<-1;q<-q+tabulate(as.vector(sets),nbins=n)/L
 selectedValues<-sum(values[above])+colSums(matrix(values[sets],nrow=r));selectedOverlap<-sum(pTop[above])+colSums(matrix(pTop[sets],nrow=r))
 ev<-mean(selectedValues);eo<-mean(selectedOverlap);close(sum(q),b);close(ev,sum(q*values));close(eo,sum(q*pTop))
 list(inclusion=vec(q),expectedValue=ev,expectedOverlap=eo,overlapShare=eo/b,selectedCount=sum(q),budget=b,boundaryGrade=h,boundaryMembers=vec(members-1L),boundarySize=length(members),remaining=r,aboveCount=length(above))
}
classification<-function(p,fp,fn,positive=NULL){n<-length(p);stopifnot(n>0,all(p>=0&p<=1),fp>=0,fn>=0,is.finite(fp+fn),fp+fn>0)
 pc<-fp*(1-p);nc<-fn*p;cut<-fp/(fp+fn);bayes<-p>=cut;pos<-if(is.null(positive))bayes else as.logical(positive)
 stopifnot(length(pos)==n,all(!is.na(pos)));falseP<-sum((1-p)[pos]);falseN<-sum(p[!pos]);total<-fp*falseP+fn*falseN
 # Exhaustive binary actions for small laws; separable two-action enumeration at each
 # unit proves the same unconstrained minimum without enumerating 2^30 league actions.
 if(n<=6){A<-as.matrix(expand.grid(rep(list(c(FALSE,TRUE)),n)));best<-min(apply(A,1,function(a)sum(ifelse(a,pc,nc))))}else best<-sum(apply(rbind(pc,nc),2,min))
 close(best,sum(ifelse(bayes,pc,nc)));stopifnot(total>=best-1e-12)
 list(positive=vec(pos),bayesPositive=vec(bayes),positiveCount=sum(pos),cutoff=cut,positiveCost=vec(pc),negativeCost=vec(nc),expectedFalsePositives=falseP,expectedFalseNegatives=falseN,totalCost=total,meanCost=total/n)
}
finite_optimum<-function(e,tau){n<-nrow(e);G<-lexsort(oracle_reports(n));rr<-vapply(seq_len(nrow(G)),function(k)evaluation(G[k,],e,tau)$risk,0);j<-which(rr<=min(rr)+1e-12);other<-rr[rr>min(rr)+1e-12];stopifnot(!length(other)||min(other)-min(rr)>1e-10)
 list(grade=G[j[1],],size=nrow(G),tieCount=length(j))}
# Every feasible contiguous cut is enumerated; direct unit-pair sums, no engine DP.
cut_optimum<-function(mean,e,tau,cap){n<-length(mean);ord<-order(-mean,seq_len(n));grades<-list();cuts<-list()
 for(h in seq_len(cap)){cc<-if(h==1)matrix(integer(),0,1)else combn(n-1,h-1)
  for(j in seq_len(ncol(cc))){g<-integer(n);g[ord]<-1L+findInterval(0:(n-1),cc[,j]);grades[[length(grades)+1L]]<-g;cuts[[length(cuts)+1L]]<-cc[,j]}}
 risk<-vapply(grades,function(g)evaluation(g,e,tau)$risk,0);ix<-which(risk<=min(risk)+1e-12);other<-risk[risk>min(risk)+1e-12];gap<-if(length(other))min(other)-min(risk)else Inf
 stopifnot(gap>1e-10,length(grades)==sum(vapply(0:(cap-1),function(k)choose(n-1,k),0)))
 diagnostics$leagueCutMinimumGap<<-gap
 list(grade=grades[[ix[1]]],size=length(grades),tieCount=length(ix))
}
# All observed data and posteriors are deterministic given the separately named measurement seed.
league_cache<-new.env(parent=emptyenv())
league_inputs<-function(measurementSeed,seed,S,priorSd){key<-paste(measurementSeed,seed,S,priorSd,sep=':');if(exists(key,league_cache,inherits=FALSE))return(get(key,league_cache))
 stopifnot(measurementSeed!=seed) # the approved fixtures use distinct measurement/integration streams
 n<-30;size<-rep(c(16,64,256),10);se<-.8/sqrt(size);theta<-.15*qnorm((((19*(1:n))%%31)-.5)/30)
 observed<-theta+se*prx_normals(measurementSeed,n);B<-priorSd^2/(priorSd^2+se^2);means<-B*observed;sds<-sqrt(B)*se
 z<-matrix(prx_normals(seed,S*n),S,n,byrow=TRUE);states<-sweep(sweep(z,2,sds,'*'),2,means,'+')
 stopifnot(min(diff(sort(means)))>1e-10,min(diff(sort(observed)))>1e-10,min(apply(states,1,function(v)min(diff(sort(v)))))>1e-10)
 out<-list(observed=observed,means=means,sds=sds,states=states,e=normal_e(means,sds));assign(key,out,league_cache);out
}
experiment<-function(law,tau=.25,budget=1L,threshold=3.5,falsePositiveCost=1,falseNegativeCost=1,positiveGrade=1L,measurementSeed=20261030,seed=1,S=2000L,priorSd=.15,cap=3L){
 if(law=='league'){
  x<-league_inputs(measurementSeed,seed,S,priorSd);means<-x$means;e<-x$e;n<-length(means);pTop<-top_prob(x$states,rep(1/S,S),budget);pAbove<-pnorm((means-threshold)/x$sds);opt<-cut_optimum(means,e,tau,cap)
 }else{
  stopifnot(law%in%c('tb17','tb19'));states<-if(law=='tb17')rbind(c(20,4),c(0,4))else rbind(c(20,4,3),c(0,4,3));p<-c(.3,.7);n<-ncol(states)
  stopifnot(all(apply(states,1,function(v)!anyDuplicated(v))));means<-colSums(states*p);pTop<-top_prob(states,p,budget);pAbove<-colSums((states>threshold)*p);e<-finite_e(states,p);opt<-finite_optimum(e,tau)
 }
 close(sum(pTop),budget,1e-10)
 grades<-list(mean=strict_order(means),top=strict_order(pTop),optimal=opt$grade,withheld=rep(1L,n));if(law=='league')grades$raw<-strict_order(x$observed)
 reports<-lapply(grades,function(g)list(grade=vec(g),evaluation=evaluation(g,e,tau),allocation=allocation(g,means,pTop,budget),classification=classification(pAbove,falsePositiveCost,falseNegativeCost,g<=positiveGrade)))
 # Independently enumerate native subsets to check both utility maxima. This is an
 # empirical top-overlap optimum for league pTop, not a guarantee for exact unknown scores.
 ss<-subsets(n,budget);if(budget==0){bestValue<-0;bestOverlap<-0}else{bestValue<-max(colSums(matrix(means[ss],nrow=budget)));bestOverlap<-max(colSums(matrix(pTop[ss],nrow=budget)))}
 close(reports$mean$allocation$expectedValue,bestValue);close(reports$top$allocation$expectedOverlap,bestOverlap)
 for(q in reports){stopifnot(q$allocation$expectedValue<=bestValue+1e-12,q$allocation$expectedOverlap<=bestOverlap+1e-12);if(positiveGrade==0)stopifnot(q$classification$positiveCount==0);if(positiveGrade>=max(q$grade))stopifnot(q$classification$positiveCount==n)}
 stopifnot(reports$withheld$evaluation$N==0,is.null(reports$withheld$evaluation$EoverN),reports$withheld$evaluation$risk==tau)
 if(law=='league')stopifnot(max(opt$grade)<=cap,opt$size==436L)else for(q in reports)stopifnot(reports$optimal$evaluation$risk<=q$evaluation$risk+1e-12)
 list(means=vec(means),pTop=vec(pTop),pAbove=vec(pAbove),n=n,M=Mof(n),reports=reports,bayesClassification=classification(pAbove,falsePositiveCost,falseNegativeCost),optimalFamilySize=opt$size,optimalTieCount=opt$tieCount)
}
base<-list(law='tb19',tau=.25,budget=1L,threshold=3.5,falsePositiveCost=1,falseNegativeCost=1,positiveGrade=1L,measurementSeed=20261030,seed=1,S=2000L,priorSd=.15,cap=3L)
specs<-list(
 list(id='native-tb19-default'),
 list(id='native-tb17-tau25',law='tb17'),
 list(id='native-tb17-tau40',law='tb17',tau=.4),
 list(id='native-tb19-budget0',budget=0L),
 list(id='native-tb19-budget2',budget=2L),
 list(id='native-tb19-budget3',budget=3L),
 list(id='native-tb19-threshold4',threshold=4),
 list(id='native-tb19-asymmetric-FP1-FN3',falseNegativeCost=3),
 list(id='native-tb19-positiveGrade0',positiveGrade=0L),
 list(id='native-tb19-positiveGrade3',positiveGrade=3L),
 list(id='native-league-budget1',law='league',tau=.2,threshold=0),
 list(id='native-league-budget5',law='league',tau=.2,threshold=0,budget=5L)
)
for(spec in specs){id<-spec$id;spec$id<-NULL;a<-modifyList(base,spec);r<-do.call(experiment,a);add(id,a,r)
 cat(id,': family',r$optimalFamilySize,'means',paste(sprintf('%.6f',r$means),collapse=','),'pTop sum',sum(r$pTop),'Bayes positives',r$bayesClassification$positiveCount,'cost',r$bayesClassification$totalCost,'\n')}
# Scientific separation checks across composition settings: budget changes no supplied-law
# means or reporting optimum; the strict event at threshold4 excludes B exactly at4.
byid<-setNames(lapply(rows,`[[`,'expect'),vapply(rows,`[[`,'','id'))
for(id in c('native-tb19-budget0','native-tb19-budget2','native-tb19-budget3')){close(byid[[id]]$means,byid[['native-tb19-default']]$means);stopifnot(identical(byid[[id]]$reports$optimal$grade,byid[['native-tb19-default']]$reports$optimal$grade))}
stopifnot(byid[['native-tb19-threshold4']]$pAbove[2]==0,byid[['native-tb19-default']]$pAbove[2]==1,byid[['native-tb19-positiveGrade0']]$reports$withheld$classification$positiveCount==0,byid[['native-tb19-positiveGrade3']]$reports$withheld$classification$positiveCount==3)
close(byid[['native-league-budget1']]$means,byid[['native-league-budget5']]$means)
assert_no_postrank();stopifnot(!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3-native-decisions',rows,'r-export/31_v3_native_decisions.R',uses_postrank=FALSE)
cat('oracle-v3-native-decisions:',length(rows),'rows.\n');print(diagnostics)
