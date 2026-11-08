# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R Part 3 experiment pins (3.11 / 3.12).
# Sources: public engine/API.md contracts and SR-06, public book ch.16 conditional
# risk / ch.17 repeated-data stability, released six-site marginal normal law,
# and the separately implemented public random stream in _rng.R.
# No new app numerical source, decision.ts or its tests were read. No postrank/JS/solver calls.
# Run from repo root: Rscript r-export/30_v3_part3_experiments.R
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');source('r-export/_rng.R')
assert_no_postrank()
vec<-function(x)I(unname(x));Mof<-function(n)n*(n-1)/2
rows<-list();diagnostics<-list()
add<-function(id,fn,args,expect,record=NULL){r<-list(id=id,args=c(list(fn=fn),args),expect=expect);if(!is.null(record))r$record<-record;rows[[length(rows)+1L]]<<-r}
close<-function(a,b,tol=1e-12){stopifnot(length(a)==length(b),all(is.na(a)==is.na(b)),max(c(0,abs(a-b)),na.rm=TRUE)<tol)}
lexsort<-function(G)G[do.call(order,as.data.frame(G)),,drop=FALSE]
normal_e<-function(m,s){n<-length(m);out<-matrix(NA_real_,n,n);for(i in seq_len(n))for(j in seq_len(n))if(i!=j)out[i,j]<-pnorm((m[j]-m[i])/sqrt(s[i]^2+s[j]^2));out}
relations_r<-function(g)sign(outer(g,g,function(a,b)b-a))
evaluation<-function(g,e,tau){n<-length(g);M<-Mof(n);a<-outer(g,g,'<');N<-sum(a);E<-sum(e[a]);list(M=M,N=N,Ew=E,EoverN=if(N)E/N else NULL,disclosure=N/M,risk=(E+tau*(M-N))/M)}
# Preserve every exact-score tie block, including a block spanning several raw tiers.
tiers<-function(scores,G){n<-length(scores);ord<-order(-scores,seq_len(n));s<-scores[ord];raw<-1+floor((seq_len(n)-1)*G/n);merge<-diag(TRUE,G)
 for(v in unique(s)){z<-unique(raw[s==v]);merge[z,z]<-TRUE};repeat{nextm<-(merge%*%merge)>0;if(identical(nextm,merge))break;merge<-nextm}
 cmp<-vapply(seq_len(G),function(k)min(which(merge[k,])),0);lab<-match(cmp[raw],unique(cmp[raw]));g<-integer(n);g[ord]<-lab;g}
# Compare fixed reports on the very same latent state. Direct unordered pair indicators,
# including weak latent equality; the withholding part always divides by all M pairs.
loss_trace<-function(g,draws,tau){S<-nrow(draws);n<-ncol(draws);M<-Mof(n);N<-0;D<-numeric(S)
 for(i in 1:(n-1))for(j in (i+1):n)if(g[i]!=g[j]){N<-N+1L;a<-if(g[i]<g[j])i else j;b<-if(g[i]<g[j])j else i;D<-D+as.numeric(draws[,a]<=draws[,b])}
 (D+tau*(M-N))/M}
comparison<-function(gb,gr,draws,tau,tieTol=1e-12){a<-loss_trace(gb,draws,tau);b<-loss_trace(gr,draws,tau);d<-b-a;S<-nrow(draws);rw<-sum(d< -tieTol);bw<-sum(d>tieTol);tt<-S-rw-bw
 close(mean(d),mean(b)-mean(a));if(S>1)close(sd(d)/sqrt(S),sqrt(sum((d-mean(d))^2)/(S*(S-1))))
 # Score every state again as a one-point conditional law: an independent vectorized
 # cross-check of the direct pair-indicator trace, including withheld-pair loss.
 for(g in list(gb,gr)){ref<-vapply(seq_len(S),function(k){e<-outer(draws[k,],draws[k,],'<=');diag(e)<-NA;evaluation(g,e,tau)$risk},0);close(ref,loss_trace(g,draws,tau))}
 stopifnot(rw+bw+tt==S)
 list(lossBest=vec(a),lossRule=vec(b),delta=vec(d),meanBest=mean(a),meanRule=mean(b),meanDelta=mean(d),mcseDelta=if(S==1)NULL else sd(d)/sqrt(S),ruleWins=rw,bestWins=bw,ties=tt,ruleWinShare=rw/S,bestWinShare=bw/S,tieShare=tt/S,S=S,tieTol=tieTol)}
cube<-function(draws)lapply(seq_len(nrow(draws)),function(s)unname(matrix(draws[s,],ncol=1)))
# Exhaustive canonical reports for the small conditional decision, separated from latent draws.
small_optimum<-function(e,tau,cap){n<-nrow(e);G<-lexsort(oracle_reports(n,cap));evals<-lapply(seq_len(nrow(G)),function(k)evaluation(G[k,],e,tau));risk<-vapply(evals,`[[`,0,'risk');ix<-which(risk<=min(risk)+1e-12);other<-risk[risk>min(risk)+1e-12];gap<-if(length(other))min(other)-min(risk)else Inf
 stopifnot(gap>1e-10);list(grade=G[ix[1],],tieCount=length(ix),familySize=nrow(G),risk=min(risk),gap=gap)}
U<-jsonlite::fromJSON(file.path(released_dir,'six-sites.json'))$tables$units
means6<-as.numeric(U$mean_A);sds6<-as.numeric(U$sd_A);stopifnot(identical(as.character(U$id),LETTERS[1:6]),all(sds6>0))
E6<-normal_e(means6,sds6)
# Check the separately calculated analytic coefficients against the released public array only.
six_json<-jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE)
released_matrix<-function(a)t(vapply(a,function(r)vapply(r,function(v)if(is.null(v))NA_real_ else as.numeric(v),0),numeric(length(a))))
close(E6,released_matrix(six_json$arrays$one$e[[1]]),1e-13)
conditional_case<-function(law,seed,S,tau=.2,cap=2L,comparator='pmtiers2'){
 if(law=='six'){
  e<-E6;op<-small_optimum(e,tau,cap);gb<-op$grade;n<-length(gb)
  gr<-switch(comparator,pmtiers2=tiers(means6,2),pmtiers3=tiers(means6,3),withheld=rep(1L,n),self=gb,stop('comparator'))
  z<-matrix(prx_normals(seed,S*n),S,n,byrow=TRUE);draws<-sweep(sweep(z,2,sds6,'*'),2,means6,'+');stopifnot(min(apply(draws,1,function(v)min(diff(sort(v)))))>1e-10)
  # Two independent evaluations of the exact conditional loss, using directional sums and
  # enumerated normal-pair errors, must agree before comparisons are emitted.
  best<-evaluation(gb,e,tau);rule<-evaluation(gr,e,tau);cmp<-comparison(gb,gr,draws,tau)
  inside<-max(gr)<=cap;if(inside)stopifnot(rule$risk>=best$risk-1e-12)
  if(comparator=='pmtiers3')stopifnot(!inside,rule$risk<best$risk)
  if(comparator=='self')stopifnot(all(cmp$delta==0),cmp$ties==S,cmp$meanDelta==0)
  if(comparator=='withheld')stopifnot(all(cmp$lossRule==tau),rule$N==0,is.null(rule$EoverN))
  out<-list(gradeBest=vec(gb),gradeRule=vec(gr),familySize=op$familySize,tieCount=op$tieCount,inFamily=inside,bestEvaluation=best,ruleEvaluation=rule,exactDelta=rule$risk-best$risk,draws=cube(draws),comparison=cmp)
 }else if(law=='tb17'){
  states<-rbind(c(20,4),c(0,4));mass<-c(.3,.7);e<-matrix(NA_real_,2,2)
  for(i in 1:2)for(j in 1:2)if(i!=j)e[i,j]<-sum(mass[states[,i]<=states[,j]])
  op<-small_optimum(e,tau,cap);gb<-op$grade;gr<-c(2L,1L);stopifnot(comparator=='BAboveA')
  u<-prx_uniforms(seed,S);cum<-cumsum(mass);idx<-vapply(u,function(v)which(v<cum)[1],0L);draws<-states[idx,,drop=FALSE]
  best<-evaluation(gb,e,tau);rule<-evaluation(gr,e,tau);a<-loss_trace(gb,states,tau);b<-loss_trace(gr,states,tau);d<-b-a
  close(sum(mass*a),best$risk);close(sum(mass*b),rule$risk)
  out<-list(gradeBest=vec(gb),gradeRule=vec(gr),familySize=op$familySize,tieCount=op$tieCount,inFamily=TRUE,bestEvaluation=best,ruleEvaluation=rule,exactDelta=rule$risk-best$risk,draws=cube(draws),comparison=comparison(gb,gr,draws,tau),stateIndices=vec(idx-1L),exactRuleWinShare=sum(mass[d< -1e-12]),exactBestWinShare=sum(mass[d>1e-12]),exactTieShare=sum(mass[abs(d)<=1e-12]),exactLossBest=vec(a),exactLossRule=vec(b),exactStateDelta=vec(d))
 }else stop('law')
 diagnostics[[paste(law,seed,S,comparator,sep='-')]]<<-list(minOptimumGap=op$gap)
 out
}
for(cmp in c('pmtiers2','pmtiers3','withheld','self')){
 args<-list(law='six',seed=1,S=100L,tau=.2,cap=2L,comparator=cmp)
 r<-do.call(conditional_case,args);add(paste0('conditional-six-S100-seed1-',cmp),'conditionalLossExperiment',args,r)
}
a<-list(law='six',seed=3,S=10L,tau=.2,cap=2L,comparator='pmtiers2');add('conditional-six-S10-seed3-pmtiers2','conditionalLossExperiment',a,do.call(conditional_case,a))
a<-list(law='tb17',seed=1,S=100L,tau=.25,cap=2L,comparator='BAboveA');add('conditional-tb17-S100-seed1-BAboveA','conditionalLossExperiment',a,do.call(conditional_case,a))
cat('Conditional experiments:',length(rows),'rows generated.\n')

# SR-06 fixed truth and two fresh measurement noises per pair. Seeds cycle inclusively
# over 1..2^32-1, preserving the first seed. No overlapping adjacent-pair baseline design.
max_seed<-4294967295
cycle_seed<-function(seed,offset)1+((seed-1+offset)%%max_seed)
lgsize<-rep(c(16,64,256),10);lgse<-.8/sqrt(lgsize);lgtheta<-.15*qnorm((((19*(1:30))%%31)-.5)/30)
stopifnot(length(unique(lgtheta))==30L,identical(unique(lgse),c(.2,.1,.05)))
posterior<-function(est,priorSd){B<-priorSd^2/(priorSd^2+lgse^2);list(mean=vec(B*est),sd=vec(sqrt(B)*lgse),shrink=vec(B))}
# Independent enumeration of every contiguous cut set; no 30-unit global report search.
# The order is held fixed for a measurement, but freshly selected from its own posterior.
cut_cache<-new.env(parent=emptyenv())
cut_design<-function(n,G){key<-paste(n,G,sep=':');if(exists(key,cut_cache,inherits=FALSE))return(get(key,cut_cache))
 cuts<-list();gp<-list()
 for(h in seq_len(G)){
  cc<-if(h==1)matrix(integer(),0,1)else combn(n-1,h-1)
  for(j in seq_len(ncol(cc))){c<-cc[,j];cuts[[length(cuts)+1L]]<-c;gp[[length(gp)+1L]]<-1L+findInterval(0:(n-1),c)}
 }
 Gpos<-do.call(rbind,gp);pp<-t(combn(n,2));A<-vapply(seq_len(nrow(pp)),function(k)as.numeric(Gpos[,pp[k,1]]<Gpos[,pp[k,2]]),numeric(nrow(Gpos)));A<-matrix(A,nrow=nrow(Gpos));N<-rowSums(A)
 stopifnot(nrow(Gpos)==sum(vapply(0:(G-1),function(k)choose(n-1,k),0)))
 out<-list(Gpos=Gpos,pairs=pp,A=A,N=N,cuts=cuts)
 assign(key,out,cut_cache);out
}
cut_choice<-function(mean,e,tau,G){n<-length(mean);ord<-order(-mean,seq_len(n));z<-cut_design(n,G);eo<-e[ord,ord];coef<-eo[z$pairs];E<-drop(z$A%*%coef);risk<-(E+tau*(Mof(n)-z$N))/Mof(n);best<-min(risk);ix<-which(risk<=best+1e-12);j<-ix[1];g<-integer(n);g[ord]<-z$Gpos[j,]
 # The cut sets were enumerated by fewer grades, then lexicographically earlier cuts.
 # Boundaries deciding these fixtures must be separated from the next candidate.
 other<-risk[risk>best+1e-12];gap<-if(length(other))min(other)-best else Inf
 stopifnot(gap>1e-10);close(evaluation(g,e,tau)$risk,best)
 # Verify every enumerated candidate by direct unit-label pair counting, separately
 # from the order-position incidence matrix used to select the optimum.
 direct<-vapply(seq_len(nrow(z$Gpos)),function(k){q<-integer(n);q[ord]<-z$Gpos[k,];evaluation(q,e,tau)$risk},0);close(direct,risk)
 list(grade=g,gap=gap,tieCount=length(ix),size=nrow(z$Gpos))
}
relation_change<-function(g0,g1){n<-length(g0);M<-Mof(n);a<-relations_r(g0);b<-relations_r(g1);upper<-upper.tri(a);x<-a[upper];y<-b[upper]
 same<-sum(x==y);nd<-sum(x==0 & y!=0);nw<-sum(x!=0 & y==0);rv<-sum(x!=0 & y!=0 & x!=y);ch<-nd+nw+rv
 stopifnot(same+ch==M,ch==sum(x!=y));list(M=M,nSame=same,nNewDisclosed=nd,nNewWithheld=nw,nReversed=rv,agreement=same/M,changed=ch,changeShare=ch/M)
}
measurement<-function(seed,G,tau,priorSd){est<-lgtheta+lgse*prx_normals(seed,30);po<-posterior(est,priorSd);m<-as.numeric(po$mean);s<-as.numeric(po$sd);e<-normal_e(m,s)
 # The frozen and simulated scores are well separated from score-tie decisions.
 stopifnot(min(diff(sort(est)))>1e-10,min(diff(sort(m)))>1e-10)
 cc<-cut_choice(m,e,tau,G);grades<-list(raw=tiers(est,G),posterior=tiers(m,G),cuts=cc$grade,withheld=rep(1L,30))
 evaluations<-lapply(grades,evaluation,e=e,tau=tau)
 stopifnot(max(cc$grade)<=G,cc$size==sum(vapply(0:(G-1),function(k)choose(29,k),0)))
 # The declared within-order optimum is no worse than the same-order posterior tiers.
 stopifnot(evaluations$cuts$risk<=evaluations$posterior$risk+1e-12)
 if(G==3)stopifnot(evaluations$raw$N==300,evaluations$posterior$N==300,cc$size==436)
 list(estimate=est,posterior=po,grades=grades,evaluations=evaluations,cutGap=cc$gap)
}
stability_case<-function(seed,replays=20L,G=3L,tau=.2,priorSd=.15){M<-Mof(30);seeds<-cycle_seed(seed,0:(2*replays-1));stopifnot(seeds[1]==seed,length(unique(seeds))==2*replays,all(seeds>=1 & seeds<=max_seed))
 out<-vector('list',replays);acc<-setNames(lapply(1:4,function(k)list(change=numeric(),N=numeric(),E=numeric())),c('raw','posterior','cuts','withheld'));gaps<-numeric()
 for(r in seq_len(replays)){
  s1<-seeds[2*r-1];s2<-seeds[2*r];a<-measurement(s1,G,tau,priorSd);b<-measurement(s2,G,tau,priorSd);gaps<-c(gaps,a$cutGap,b$cutGap);rr<-list()
  for(rule in names(acc)){
   g1<-a$grades[[rule]];g2<-b$grades[[rule]];ch<-relation_change(g1,g2);e1<-a$evaluations[[rule]];e2<-b$evaluations[[rule]]
   rr[[rule]]<-list(grade1=vec(g1),grade2=vec(g2),evaluation1=e1,evaluation2=e2,change=ch)
   acc[[rule]]$change<-c(acc[[rule]]$change,ch$changeShare);acc[[rule]]$N<-c(acc[[rule]]$N,e1$N,e2$N);acc[[rule]]$E<-c(acc[[rule]]$E,e1$Ew,e2$Ew)
   # A monotone relabeling is not a change in the pair relation.
   close(relation_change(g1*2+1,g2*2+1)$changeShare,ch$changeShare)
  }
  out[[r]]<-list(r=r,seed1=s1,seed2=s2,estimate1=vec(a$estimate),estimate2=vec(b$estimate),posterior1=a$posterior,posterior2=b$posterior,rules=rr)
 }
 summary<-lapply(acc,function(a){N<-sum(a$N);E<-sum(a$E);list(meanChangeShare=mean(a$change),meanDisclosure=N/(2*replays*M),pooledEoverN=if(N)E/N else NULL,totalE=E,totalN=N)})
 stopifnot(summary$withheld$meanChangeShare==0,summary$withheld$meanDisclosure==0,is.null(summary$withheld$pooledEoverN),summary$withheld$totalN==0,summary$withheld$totalE==0)
 diagnostics[[paste('stability',seed,replays,G,tau,priorSd,sep='-')]]<<-list(minCutRiskGap=min(gaps),observations=2*replays,uniqueSeeds=length(unique(seeds)))
 list(seeds=vec(seeds),pairs=out,summary=summary)
}
for(spec in list(list(id='stability-default-seed20261030-R20',seed=20261030,replays=20L,G=3L,tau=.2,priorSd=.15),list(id='stability-low-tau05',seed=20261030,replays=20L,G=3L,tau=.05,priorSd=.15),list(id='stability-narrow-prior05',seed=20261030,replays=20L,G=3L,tau=.2,priorSd=.05),list(id='stability-max-seed-wrap-R2',seed=max_seed,replays=2L,G=3L,tau=.2,priorSd=.15),list(id='stability-one-grade-R2',seed=20261030,replays=2L,G=1L,tau=.2,priorSd=.15))){
 id<-spec$id;spec$id<-NULL;ans<-do.call(stability_case,spec);add(id,'stabilityExperiment',spec,ans)
 cat(id,':',paste(vapply(ans$summary,function(x)sprintf('change %.6f/disclosure %.6f/pooled %s',x$meanChangeShare,x$meanDisclosure,if(is.null(x$pooledEoverN))'NA'else sprintf('%.6f',x$pooledEoverN)),''),collapse=' | '),'\n')
}
# Reusing the same measurement settings across policy contrasts must preserve the
# actual observations. Tau does not change the posterior; prior SD does not change raw tiers.
stab<-Filter(function(r)r$args$fn=='stabilityExperiment',rows)
base<-stab[[1]]$expect
for(k in c(2L,3L))for(r in seq_along(base$pairs)){
 a<-base$pairs[[r]];b<-stab[[k]]$expect$pairs[[r]]
 stopifnot(identical(a$estimate1,b$estimate1),identical(a$estimate2,b$estimate2),identical(a$rules$raw$grade1,b$rules$raw$grade1),identical(a$rules$raw$grade2,b$rules$raw$grade2))
 if(k==2L)stopifnot(identical(a$posterior1,b$posterior1),identical(a$posterior2,b$posterior2),identical(a$rules$posterior$grade1,b$rules$posterior$grade1),identical(a$rules$posterior$grade2,b$rules$posterior$grade2))
}
assert_no_postrank();stopifnot(!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3p3-experiments',rows,'r-export/30_v3_part3_experiments.R',uses_postrank=FALSE)
cat('oracle-v3p3-experiments:',length(rows),'rows.\n');print(diagnostics)
