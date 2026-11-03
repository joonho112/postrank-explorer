# Author: JoonHo Lee (jlee296@ua.edu)
# Independent Part4 display/composition pins. Read installed public data and
# cached RDS values; never call load_or_compute, a package solver, TS or app JS.
# Gaussian intervals/probabilities/ranks and finite compositions use base R.
# Archive fields are checked against their installed original cached objects,
# preserving raw bounds/status/gaps and the sparse path without interpolation.
# Run: Rscript r-export/37_v3_part4_profiles.R
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R')
assert_no_postrank()
write_json_stable<-function(x,path){dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE);writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE);invisible(path)}

# Reuse only independently authored, committed pure R35 definitions. Parsing
# does not execute its source() setup, data reads, cases, writer or generation.
pureNames<-c('vec','%or%','Mof','lexsort','gl','earr','uncube','weights','evaluate','change','allreports','familyCache','familyreports','optimum','optbrief','finite','wrong','composite')
pureFound<-character()
for(expr in parse('r-export/35_v3_part4.R'))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pureNames){eval(expr);pureFound<-c(pureFound,as.character(expr[[2]]))}
stopifnot(setequal(pureFound,pureNames));assert_no_postrank()
rows<-list();checks<-list();add<-function(id,fn,args,expect)rows[[length(rows)+1L]]<<-list(id=id,args=c(list(fn=fn),args),expect=expect)
close<-function(a,b,tol=1e-12){stopifnot(length(a)==length(b),identical(as.logical(is.na(a)),as.logical(is.na(b))),all(abs(a[!is.na(a)]-b[!is.na(b)])<=tol*(1+abs(a[!is.na(a)]))));invisible(TRUE)}
columnar<-function(df,keep=names(df))setNames(lapply(keep,function(k)vec(df[[k]])),keep)
jsonnum<-function(x)vapply(x,function(z)z %or% NA_real_,0)
samecols<-function(want,got){for(k in names(want)){a<-want[[k]];b<-got[[k]];if(is.numeric(a))close(as.numeric(a),jsonnum(b),1e-13)else if(is.logical(a))stopifnot(identical(as.logical(a),unlist(b,use.names=FALSE)))else stopifnot(identical(as.character(a),unlist(b,use.names=FALSE)))};invisible(TRUE)}
release<-function(key)jsonlite::fromJSON(file.path(released_dir,paste0(key,'.json')),simplifyVector=FALSE)

# Installed datasets are the source, rather than the exported JSON columns.
inputs<-new.env(parent=emptyenv())
utils::data(list=c('pr_tutorial','pr_example_gaussian'),package='postrank',lib.loc=postrank_lib,envir=inputs)
assert_no_postrank()
tu<-inputs$pr_tutorial;ga<-inputs$pr_example_gaussian
laws<-list(six=list(ids=tu$units$entity_id,criteria=tu$two$criterion_ids,means=unname(tu$law$means),sds=unname(sqrt(t(apply(tu$law$covariance,3,diag)))),e=unname(tu$two$e)),thirty=list(ids=ga$entity_ids,criteria=ga$criterion_ids,means=unname(ga$means),sds=unname(sqrt(t(apply(ga$source$covariance,3,diag)))),e=unname(ga$e)))
normalErrors<-function(means,sds){n<-nrow(means);K<-ncol(means);e<-array(NA_real_,c(n,n,K));for(k in seq_len(K))for(i in seq_len(n))for(j in seq_len(n))if(i!=j)e[i,j,k]<-pnorm((means[j,k]-means[i,k])/sqrt(sds[i,k]^2+sds[j,k]^2));e}
for(key in names(laws)){x<-laws[[key]];rr<-release(if(key=='six')'six-sites'else 'thirty-sites');ea<-if(key=='six')rr$arrays$two else rr$arrays$gaussian;stopifnot(identical(x$ids,unlist(rr$tables$units$id,use.names=FALSE)),identical(x$ids,unlist(ea$ids,use.names=FALSE)),identical(x$criteria,unlist(ea$criteria,use.names=FALSE)))
 for(k in seq_along(x$criteria)){suffix<-if(key=='six')c('A','B')[k]else x$criteria[k];close(x$means[,k],jsonnum(rr$tables$units[[paste0('mean_',suffix)]]),1e-13);close(x$sds[,k],jsonnum(rr$tables$units[[paste0('sd_',suffix)]]),1e-13)}
 close(x$e,uncube(ea),1e-13);close(x$e,normalErrors(x$means,x$sds),1e-13)}

# Whole-array labels/order are retained. Each normal pair uses independence of
# DISTINCT entities only; this never assumes thirty-site criteria independent.
profile<-function(data,level,orient,pair){x<-laws[[data]];n<-length(x$ids);K<-length(x$criteria);m<-sweep(x$means,2,orient,'*');sd<-x$sds;e<-normalErrors(m,sd);z<-qnorm((1+level)/2);ints<-lapply(seq_len(K),function(k)lapply(seq_len(n),function(i)list(lower=m[i,k]-z*sd[i,k],upper=m[i,k]+z*sd[i,k])));rk<-sapply(seq_len(K),function(k)1+rowSums(e[,,k],na.rm=TRUE));pp<-list()
 for(i in seq_len(n-1))for(j in (i+1):n){d<-e[j,i,]-e[i,j,];ia<-which(d>1e-12)-1L;ja<-which(d< -1e-12)-1L;if(length(ia)&&length(ja))pp[[length(pp)+1L]]<-list(i=i-1L,j=j-1L,iAbove=vec(ia),jAbove=vec(ja))}
 profiles<-lapply(seq_len(K),function(k){o<-order(-m[,k],x$ids,method='radix');stopifnot(!anyDuplicated(m[,k]));list(criterion=x$criteria[k],mean=vec(m[,k]),sd=vec(sd[,k]),intervals=ints[[k]],scoreOrder=list(order=vec(o-1L),blocks=vec(rep(1L,n))),expectedRank=vec(rk[,k]))})
 i<-pair[1]+1L;j<-pair[2]+1L;selected<-lapply(seq_len(K),function(k){d<-sqrt(sd[i,k]^2+sd[j,k]^2);list(criterion=x$criteria[k],iMean=m[i,k],iSd=sd[i,k],jMean=m[j,k],jSd=sd[j,k],iInterval=ints[[k]][[i]],jInterval=ints[[k]][[j]],eIJ=e[i,j,k],eJI=e[j,i,k],piIJ=pnorm((m[i,k]-m[j,k])/d),piJI=pnorm((m[j,k]-m[i,k])/d),equality=0)})
 list(ids=vec(x$ids),criteria=vec(x$criteria),orient=vec(orient),means=unname(m),sds=unname(sd),E=earr(e,x$ids,x$criteria),profiles=profiles,expectedRank=vec(rowMeans(rk)),conflicts=list(count=length(pp),pairs=pp),pair=list(i=pair[1],j=pair[2],criteria=selected))}
for(s in list(list(id='six-90',data='six',level=.9,orient=c(1,1),pair=c(1L,2L)),list(id='six-95',data='six',level=.95,orient=c(1,1),pair=c(1L,3L)),list(id='six-B-negative-90',data='six',level=.9,orient=c(1,-1),pair=c(1L,2L)),list(id='thirty-90',data='thirty',level=.9,orient=c(1,1,1),pair=c(0L,1L)),list(id='thirty-95',data='thirty',level=.95,orient=c(1,1,1),pair=c(0L,1L))))add(paste0('profiles-',s$id),'criterionProfilesPart4',list(data=s$data,level=s$level,orient=vec(s$orient),pair=vec(s$pair)),profile(s$data,s$level,s$orient,s$pair))
stopifnot(rows[[1]]$expect$conflicts$count==3L,rows[[4]]$expect$conflicts$count==397L)
for(k in seq_len(2)){close(rows[[1]]$expect$profiles[[k]]$expectedRank,1+rowSums(laws$six$e[,,k],na.rm=TRUE))}

# Installed archive caches are read ONLY when the shipped manifest/file/hash
# are present. There is deliberately no load_or_compute fallback or new solve.
cacheRoot<-file.path(postrank_lib,'postrank');manifestPath<-file.path(cacheRoot,'extdata','manifests','cache-manifest.json');stopifnot(file.exists(manifestPath));cm<-jsonlite::fromJSON(manifestPath,simplifyVector=FALSE);stopifnot(cm$package_version=='1.1.0')
cache<-function(key){r<-cm$assets[[key]];stopifnot(!is.null(r));path<-file.path(cacheRoot,r$file);if(!file.exists(path))stop('Missing installed cache; this oracle never computes: ',key);stopifnot(identical(sha256_file(path),r$sha256));z<-readRDS(path);stopifnot(!is.null(z$value));z$value}
src<-function(key){r<-cm$assets[[key]];list(object=key,path=paste0('inst/',r$file),rds_sha256=r$sha256)}
cacheReleased<-release('cache-30x3')$analyses
snapshot<-function(tau){key<-if(tau==.25)'analysis_30x3'else 'analysis_30x3_tau35';ckey<-if(tau==.25)'commonality_30x3'else 'commonality_30x3_tau35';a<-cache(key);co<-cache(ckey);g<-unname(a$evaluation$grade);ids<-a$pairwise$entity_ids;criteria<-a$pairwise$criterion_ids;ev<-evaluate(g,unname(a$pairwise$e),tau,unname(a$settings$weights));close(ev$risk,a$evaluation$primary_risk);close(ev$E,a$evaluation$E);stopifnot(identical(names(a$evaluation$grade),ids),ev$N==a$evaluation$N)
 facts<-list(tau=a$settings$tau,G_max=a$settings$G_max,weights=as.list(a$settings$weights),n=length(ids),M=a$evaluation$M,N=a$evaluation$N,G=a$evaluation$G,sizes=vec(as.integer(table(factor(g,levels=seq_len(max(g)))))),disclosure_rate=a$evaluation$disclosure_rate,risk=a$evaluation$primary_risk,lower_bound=a$fit$objective$risk_lower_bound,gap=a$fit$objective$risk_absolute_gap,status=a$fit$status$normalized,bound_source=a$fit$objective$bound_source)
 units<-list(id=vec(ids),grade=vec(g));p<-data.frame(criterion=criteria,weight=unname(a$settings$weights),E=unname(a$evaluation$E),E_over_M=unname(a$evaluation$E_over_M),E_over_N=unname(a$evaluation$E_over_N),risk=unname(a$evaluation$criterion_risk));pf<-columnar(p);costs<-columnar(co$table)
 # Separate source family/law: these cached analyses use the 4,000 joint
 # pr_example_draws coefficients, unlike the thirty-site Gaussian profile.
 stopifnot(a$input$data_object=='pr_example_draws',identical(ids,unlist(cacheReleased[[key]]$tables$units$id,use.names=FALSE)));samecols(units,cacheReleased[[key]]$tables$units);samecols(pf,cacheReleased[[key]]$tables$profile);samecols(costs,cacheReleased[[ckey]]$tables$costs)
 for(k in names(facts)){want<-facts[[k]];got<-cacheReleased[[key]]$facts[[k]];if(is.numeric(want))close(as.numeric(want),if(is.list(got))jsonnum(got)else got,1e-13)else if(is.character(want))stopifnot(identical(want,got))}
 close(co$table$common_grade_risk,a$evaluation$criterion_risk);stopifnot(identical(src(key)$rds_sha256,cacheReleased[[key]]$source$rds_sha256),identical(src(ckey)$rds_sha256,cacheReleased[[ckey]]$source$rds_sha256))
 list(analysis=list(source=src(key),facts=facts,tables=list(units=units,profile=pf)),costs=list(source=src(ckey),table=costs))}
for(tau in c(.25,.35))add(paste0('archive30-tau',tau),'archivedCriteriaPart4',list(tau=tau),snapshot(tau))
f<-cache('frontier_30x3');pathKeep<-c('tau','status','G','N','disclosure_rate','primary_risk','weighted_risk','risk_absolute_gap','E_over_N_poverty','E_over_N_frl','E_over_N_snap','risk_poverty','risk_frl','risk_snap');path<-columnar(f$table,pathKeep);samecols(path,cacheReleased$frontier_30x3$tables$path);stopifnot(identical(as.integer(f$table$N),c(0L,0L,0L,0L,131L,276L,305L,312L)))
add('archive30-sparse-path','archivedPathPart4',list(),list(source=src('frontier_30x3'),facts=list(G_max=f$G_max,weights=as.list(f$weights),objective=f$objective),path=path))
s<-cache('tutorial_sensitivity');rs<-release('cache-tutorial')$analyses$tutorial_sensitivity
grid<-columnar(s$grid,c('setting_id','label','tau','G_max','w_score_A','w_score_B','is_reference'));results<-columnar(s$table,c('setting_id','risk','N','disclosure_rate','G','status','risk_lower_bound','risk_upper_bound','risk_absolute_gap','bound_source','E_over_N_score_A','E_over_N_score_B'));grades<-c(list(id=vec(rownames(s$grades))),lapply(seq_len(ncol(s$grades)),function(k)vec(s$grades[,k])));names(grades)<-c('id',colnames(s$grades));changes<-columnar(s$changes)
for(tab in c('grid','results','grades','changes'))samecols(get(tab),rs$tables[[tab]])
stopifnot(nrow(s$grid)==7L,identical(s$reference_id,'S01'),sum(s$grid$is_reference)==1L)
# Independently enumerate the small same-law families to verify displayed
# reports/risk, while retaining the archive's status and raw bound endpoints.
for(i in seq_len(7)){w<-c(s$grid$w_score_A[i],s$grid$w_score_B[i]);o<-optimum(laws$six$e,s$grid$tau[i],w,list(kind='atMost',G=s$grid$G_max[i]));close(o$risk,s$table$risk[i]);stopifnot(any(vapply(o$grades,function(g)identical(as.integer(g),as.integer(s$grades[,i])),TRUE)))}
add('tutorial-seven-one-at-a-time','tutorialSensitivityPart4',list(),list(referenceId=s$reference_id,grid=grid,results=results,grades=grades,changes=changes))

# Existing approved public finiteCompositePart4 dispatch, evaluated using only
# the independent R35 pure functions above. Two extra known-state book cases
# and a whole-law increasing pushforward pin complete the display presets.
finiteadd<-function(id,states,p,a,w,tau,multiplier=NULL){args<-list(states=lapply(states,unname),probs=vec(p),a=vec(a),w=vec(w),tau=tau,family=list(kind='all'));if(!is.null(multiplier))args$multiplier<-vec(multiplier);add(id,'finiteCompositePart4',args,composite(states,p,a,w,tau,multiplier))}
finiteadd('display-known-multiplier025',list(rbind(c(1,-2),c(0,0))),1,c(.5,.5),c(.75,.25),.3,c(1,.25))
finiteadd('display-known-composite-tie',list(rbind(c(1,-1),c(0,0))),1,c(.5,.5),c(.75,.25),.3)
states<-list(rbind(c(4,4),c(3,2),c(2,3),c(1,1)),rbind(c(3,1),c(4,2),c(2,3),c(1,4)))
finiteadd('display-ch19-transform-before',states,c(.75,.25),c(.75,.25),c(.6,.4),.2)
finiteadd('display-ch19-transform-exp',lapply(states,exp),c(.75,.25),c(.75,.25),c(.6,.4),.2)
before<-rows[[12]]$expect;after<-rows[[13]]$expect;stopifnot(identical(before$criterionE,after$criterionE),identical(before$criterionOptimum,after$criterionOptimum),identical(before$reports[[1]]$wrong,after$reports[[1]]$wrong))

twoScores<-function(w,tau=.2,family=list(kind='atMost',G=3L)){e<-laws$six$e;o<-optimum(e,tau,w,family);ev<-evaluate(o$grade,e,tau,w);full<-c(o,ev[c('N','G','Ew','E','EoverN')],list(evaluation=ev,familySize=nrow(familyreports(6,family)),containsAllWithheld=TRUE,tieTol=1e-12,label='exact-within-family'));profiles<-lapply(o$grades,function(g){p<-evaluate(g,e,tau,w);weightedE<-sum(w*p$E);slack<-tau*p$N-weightedE;meets<-slack>= -1e-12;list(grade=g,evaluation=p,conditionalBounds=list(weightedBudget=list(rows=list(list(k=0L,criterion='weighted',q=tau,E=weightedE,N=p$N,qN=tau*p$N,EoverN=if(p$N)weightedE/p$N else NULL,slack=slack,meets=meets)),meets=meets),riskDifference=p$risk-tau))});list(optimum=full,profiles=profiles)}
for(w in list(c(0,1),c(.5,.5)))add(paste0('two-scores-w',paste(w,collapse='-')),'twoScoresPart4',list(w=vec(w),tau=.2,family=list(kind='atMost',G=3L)),twoScores(w))
stopifnot(rows[[14]]$expect$optimum$tieCount==2L,length(rows[[14]]$expect$profiles)==2L)

# Actual 4.7 display routes: retain every explicit criterion protection even
# at zero objective weight. Feasibility is the existing count residual <=1e-12.
largest<-function(g,e,w){n<-length(g);best<-NULL;for(i in seq_len(n))for(j in seq_len(n))if(g[i]<g[j]){v<-sum(w*e[i,j,]);if(is.null(best)||v>best$e)best<-list(e=v,i=i-1L,j=j-1L)};best}
budgetDisplay<-function(w,tau,family,q){e<-laws$six$e;G<-familyreports(6,family);baseSize<-nrow(G);ee<-t(apply(G,1,function(g)evaluate(g,e,tau,w)$E));N<-apply(G,1,function(g)sum(outer(g,g,'<')));active<-which(!vapply(q,is.null,TRUE));ok<-rep(TRUE,baseSize)
 for(k in active)ok<-ok&(ee[,k]-q[[k]]*N<=1e-12)
 size<-sum(ok);contains<-if(size)any(apply(G[ok,,drop=FALSE],1,function(g)length(unique(g))==1L))else FALSE
 if(!size)return(list(empty=TRUE,size=0L,baseSize=baseSize,containsAllWithheld=FALSE,optimum=NULL,check=NULL,largest=NULL,largestByCriterion=rep(list(NULL),2L)))
 o<-optimum(e,tau,w,family,G=G[ok,,drop=FALSE]);ev<-evaluate(o$grade,e,tau,w);full<-c(o,ev[c('N','G','Ew','E','EoverN')],list(evaluation=ev,familySize=size,baseSize=baseSize,containsAllWithheld=contains,tieTol=1e-12,label='exact-within-family'))
 cr<-lapply(active,function(k){E<-as.numeric(ev$E[k]);qN<-q[[k]]*ev$N;list(k=k-1L,criterion=laws$six$criteria[k],q=q[[k]],E=E,N=ev$N,qN=qN,EoverN=if(ev$N)E/ev$N else NULL,slack=qN-E,meets=E-qN<=1e-12)})
 list(empty=FALSE,size=size,baseSize=baseSize,containsAllWithheld=contains,optimum=full,check=list(rows=cr,meets=all(vapply(cr,function(r)r$meets,TRUE))),largest=largest(o$grade,e,w),largestByCriterion=lapply(seq_len(2L),function(k)largest(o$grade,e,as.numeric(seq_len(2L)==k))))}
budgetSpecs<-list(list(id='A-only-qB15',w=c(1,0),q=list(NULL,.15),family=list(kind='atMost',G=3L)),list(id='A-only-qB05',w=c(1,0),q=list(NULL,.05),family=list(kind='atMost',G=3L)),list(id='A-only-no-budget',w=c(1,0),q=list(NULL,NULL),family=list(kind='atMost',G=3L)),list(id='equal-both02-cap3',w=c(.5,.5),q=list(.02,.02),family=list(kind='atMost',G=3L)),list(id='equal-both02-exact3-empty',w=c(.5,.5),q=list(.02,.02),family=list(kind='exactly',G=3L)),list(id='exact3-raw-B-boundary',w=c(.5,.5),q=list(NULL,.02673288763935218),family=list(kind='exactly',G=3L)),list(id='cap3-both-zero-N0',w=c(.5,.5),q=list(0,0),family=list(kind='atMost',G=3L)),list(id='A-only-qB30-active',w=c(1,0),q=list(NULL,.30),family=list(kind='atMost',G=3L)))
for(s in budgetSpecs)add(paste0('budget-display-',s$id),'budgetDisplayPart4',list(w=vec(s$w),tau=.2,family=s$family,q=s$q),budgetDisplay(s$w,.2,s$family,s$q))
stopifnot(rows[[16]]$expect$size==32L,rows[[17]]$expect$size==7L,rows[[20]]$expect$empty,rows[[22]]$expect$optimum$N==0L,is.null(rows[[22]]$expect$largest),rows[[23]]$expect$size<603L)
assert_no_postrank();stopifnot(length(rows)==23L,!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3p4-profiles',rows,'r-export/37_v3_part4_profiles.R',uses_postrank=FALSE)
cat('oracle-v3p4-profiles:',length(rows),'rows; installed data/cache joins and base-R science PASS; no package namespace/solver loaded.\n')
