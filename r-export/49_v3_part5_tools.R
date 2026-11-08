# Author: JoonHo Lee (jlee296@ua.edu).
# Independent R49 Tools fixtures from frozen spec-v3-part5-tools.md and old public API.
# No new Tools/TS/JS source or output is read; no postrank namespace or heavy MIP.
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');source('r-export/_rng.R')
assert_no_postrank()
write_json_stable<-function(x,path){dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE);writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE);invisible(path)}
extract<-function(path,names){found<-character();for(expr in parse(path))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%names){eval(expr,envir=.GlobalEnv);found<-c(found,as.character(expr[[2]]))};stopifnot(setequal(found,names))}
extract('r-export/35_v3_part4.R',c('vec','%or%','Mof','lexsort','gl','earr','uncube','weights','evaluate','change','allreports','familyCache','familyreports','optimum'))
extract('r-export/46_v3_part5_cases.R',c('num','ksum','rowSum','weighted','rankOrder','orderDP'))
release<-function(key)jsonlite::fromJSON(file.path(released_dir,paste0(key,'.json')),simplifyVector=FALSE)
rows<-list();add<-function(id,fn,args,expect){stopifnot(!id%in%vapply(rows,`[[`,'','id'));rows[[length(rows)+1L]]<<-list(id=id,args=c(list(fn=fn),args),expect=expect);invisible(expect)}
matRows<-function(m)lapply(seq_len(nrow(m)),function(i)vec(m[i,]))
orderedCount<-function(n,cap){cap<-min(n,cap);S<-matrix(0,n+1,cap+1);S[1,1]<-1;for(i in seq_len(n))for(k in seq_len(min(i,cap)))S[i+1,k+1]<-k*S[i,k+1]+S[i,k];sum(S[n+1,-1]*factorial(seq_len(cap)))}
# Exact unrounded original SR06 draw; unlike older display fixtures no 15-digit rounding.
lg<-list(ids=sprintf('U%02d',1:30),size=rep(c(16,64,256),10));lg$se<-.8/sqrt(lg$size);lg$rank<-(19*(1:30))%%31;lg$theta<-.15*qnorm((lg$rank-.5)/30)
est<-lg$theta+lg$se*prx_normals(20261030,30)
stopifnot(identical(unique(lg$se),c(.2,.1,.05)),length(unique(est))==30L)
normalE<-function(m,s,orient,ids,criteria){n<-nrow(m);K<-ncol(m);e<-array(NA_real_,c(n,n,K));for(k in seq_len(K))for(i in seq_len(n))for(j in seq_len(n))if(i!=j)e[i,j,k]<-pnorm((orient[k]*m[j,k]-orient[k]*m[i,k])/sqrt(s[i,k]^2+s[j,k]^2));list(raw=e,E=earr(e,ids,criteria))}
finish<-function(e,ids,w,tau,cap,method,ord=NULL){n<-length(ids);if(method=='enumeration'){f<-if(identical(cap,'all'))list(kind='all')else list(kind='atMost',G=cap);G<-familyreports(n,f);o<-optimum(e,tau,w,f,maxTies=100L,G=G);size<-nrow(G)}else{o<-orderDP(e,w,tau,ord,cap);size<-o$family$size};list(grade=o$grade,grades=o$grades,tieCount=o$tieCount,tieTol=1e-12,evaluation=evaluate(o$grade,e,tau,w),familySize=size,containsAllWithheld=TRUE,label=if(method=='enumeration')'exact-within-family'else'optimal-within-order')}
six<-release('six-sites');cde<-release('case-cde');krw<-release('case-krw');ala<-release('case-alabama')
your<-function(a){posterior<-NULL
 if(a$example=='six'){e<-uncube(six$arrays$two);ids<-unlist(six$arrays$two$ids);criteria<-unlist(six$arrays$two$criteria);if(a$event=='higher_priority')e<-1-(1-e);for(k in seq_along(a$orient))if(a$orient[k]<0)e[,,k]<-t(e[,,k]);E<-earr(e,ids,criteria)
 }else{if(a$example=='equal5'){ids<-LETTERS[1:5];criteria<-paste0('c',1:3);m<-matrix(0,5,3);s<-matrix(1,5,3)}else{n<-if(a$example=='league8')8L else 30L;ids<-head(lg$ids,n);criteria<-'theta';x<-head(est,n);se<-head(lg$se,n);B<-if(a$prior=='flat')rep(1,n)else .15^2/(.15^2+se^2);m<-matrix(B*x,n,1);s<-matrix(sqrt(B)*se,n,1)}
  z<-normalE(m,s,num(a$orient),ids,criteria);e<-z$raw;E<-z$E;crit<-qnorm(.95);posterior<-list(mean=matRows(m),sd=matRows(s),lower=matRows(m-crit*s),upper=matRows(m+crit*s))}
 n<-length(ids);capN<-if(identical(a$cap,'all'))n else a$cap;size<-orderedCount(n,capN);pre<-list(nAllowed=n<=20L,countAllowed=size<=600000,familySize=size);method<-if(pre$nAllowed&&pre$countAllowed)'enumeration'else'weighted-expected-rank-order';ord<-rankOrder(e,num(a$w),ids);o<-finish(e,ids,num(a$w),a$tau,a$cap,if(method=='enumeration')method else'dp',ord)
 list(E=E,posterior=posterior,preflight=pre,method=method,expectedRank=ord$expectedRank,order=if(method=='enumeration')NULL else ord$order,blocks=if(method=='enumeration')NULL else ord$blocks,optimum=o)
}
base<-list(example='league8',prior='normal',tau=.2,cap=3L,w=vec(1),orient=vec(1),maxTies=100L)
for(id in c('league8-posterior','league8-flat','league8-normal','six-probabilities','league30-posterior','equal5')){
 a<-base;a$format<-if(grepl('flat|normal$',id))'estimates'else'posterior'
 if(id=='league8-flat')a$prior<-'flat'
 if(id=='six-probabilities'){a$example<-'six';a$format<-'probabilities';a$event<-'directional_error';a$w<-vec(c(.5,.5));a$orient<-vec(c(1,1))}
 if(id=='league30-posterior')a$example<-'league30'
 if(id=='equal5'){a$example<-'equal5';a$tau<-.5;a$cap<-'all';a$w<-vec(rep(1/3,3));a$orient<-vec(c(1,-1,1))}
 a$zeroTies<-TRUE;a$margin<-0;add(paste0('tool-your-',id),'toolYourData',a,your(a))
}
for(cfg in list(list(id='equal5-withheld',example='equal5',tau=.2,cap='all',w=vec(rep(1/3,3)),orient=vec(c(1,-1,1))),list(id='equal5-onehot',example='equal5',tau=.5,cap='all',w=vec(c(0,1,0)),orient=vec(c(1,-1,1))),list(id='six-first-only',example='six',tau=.2,cap=3L,w=vec(c(1,0)),orient=vec(c(1,1))),list(id='six-second-only',example='six',tau=.2,cap=3L,w=vec(c(0,1)),orient=vec(c(1,1))),list(id='six-higher-priority',example='six',tau=.2,cap=3L,w=vec(c(.5,.5)),orient=vec(c(1,1))),list(id='six-reverse-second',example='six',tau=.2,cap=3L,w=vec(c(.5,.5)),orient=vec(c(1,-1))))){id<-cfg$id;cfg$id<-NULL;cfg$prior<-'normal';cfg$event<-if(id=='six-higher-priority')'higher_priority'else'directional_error';cfg$format<-if(cfg$example=='six')'probabilities'else'posterior';cfg$zeroTies<-TRUE;cfg$margin<-0;cfg$maxTies<-100L;add(paste0('tool-your-',id),'toolYourData',cfg,your(cfg))}
# Case errors remain exact released probabilities, preserving joint-unit dependence.
designer<-function(a){d<-switch(a$case,cde=cde,krw=krw,alabama=ala);e<-uncube(d$arrays$error);ids<-unlist(d$arrays$error$ids);w<-num(a$w);n<-length(ids)
 if(a$case=='cde'){archive<-num(d$analyses$case_cde_12$tables$units$grade);facts<-d$analyses$case_cde_12$facts;ord<-list(order=vec(order(-num(d$tables$units$mean),ids,method='radix')-1L),blocks=vec(rep(1L,n)));method<-if(a$cap<=3)'enumeration'else'posterior-mean-order'
 }else{key<-if(a$case=='krw')'case_krw_signed97'else'case_alabama67';archive<-num(d$analyses[[key]]$tables$units$grade);facts<-d$analyses[[key]]$facts;ord<-rankOrder(e,w,ids);method<-'weighted-expected-rank-order'}
 o<-finish(e,ids,w,a$tau,a$cap,if(method=='enumeration')method else'dp',ord);g<-o$grade;ev<-o$evaluation;budget<-list()
 for(k in seq_along(a$q))if(!is.null(a$q[[k]])){q<-a$q[[k]];Ek<-num(ev$E)[k];qN<-q*ev$N;budget[[length(budget)+1L]]<-list(k=k-1L,q=q,N=ev$N,E=Ek,EoverN=if(ev$N)Ek/ev$N else NULL,qN=qN,slack=qN-Ek,meets=Ek<=qN+1e-12)}
 list(method=method,order=if(method=='enumeration')NULL else ord$order,blocks=if(method=='enumeration')NULL else ord$blocks,optimum=o,archive=list(grade=vec(archive),evaluation=evaluate(archive,e,a$tau,w),sourceFacts=facts),change=change(archive,g,e,w),budget=budget)
}
for(id in c('cde','krw','alabama','cde-budget','cde-cap2','cde-cap4','cde-withheld')){which<-if(grepl('^cde',id))'cde'else id;K<-if(which=='cde')1L else 2L;a<-list(case=which,tau=if(which=='krw').25 else .2,cap=if(which=='cde')3L else if(which=='krw')4L else 5L,w=vec(rep(1/K,K)),q=rep(list(NULL),K));if(id=='cde-cap2')a$cap<-2L;if(id=='cde-cap4')a$cap<-4L;if(id=='cde-withheld')a$cap<-1L;if(id%in%c('cde-budget','cde-cap2','cde-cap4','cde-withheld'))a$q<-list(.1);add(paste0('tool-designer-',id),'toolReportDesigner',a,designer(a))}
# Semantic checks before serialization, independent of future actuals.
byid<-setNames(lapply(rows,`[[`,'expect'),vapply(rows,`[[`,'','id'))
stopifnot(byid[['tool-your-equal5']]$optimum$tieCount==541L,length(byid[['tool-your-equal5']]$optimum$grades)==100L,byid[['tool-your-equal5-withheld']]$optimum$evaluation$N==0L,identical(byid[['tool-your-equal5-withheld']]$optimum$evaluation$EoverN,rep(list(NULL),3)),!byid[['tool-your-league30-posterior']]$preflight$nAllowed,!byid[['tool-your-league30-posterior']]$preflight$countAllowed,byid[['tool-designer-cde-withheld']]$budget[[1]]$meets,byid[['tool-designer-cde-cap2']]$optimum$familySize==4095L,byid[['tool-designer-cde-cap4']]$optimum$familySize==232L,byid[['tool-designer-cde-budget']]$optimum$evaluation$N==byid[['tool-designer-cde']]$optimum$evaluation$N)
assert_no_postrank();write_golden('oracle-v3p5-tools',rows,'r-export/49_v3_part5_tools.R',uses_postrank=FALSE)
path<-file.path(golden_dir,'oracle-v3p5-tools.json');written<-jsonlite::fromJSON(path,simplifyVector=FALSE);manifest<-jsonlite::fromJSON(file.path(manifest_dir,'oracle-v3p5-tools.json'))
numbers<-function(x){if(is.list(x))return(unlist(lapply(x,numbers),use.names=FALSE));if(is.numeric(x))return(as.numeric(x[is.finite(x)]));numeric()}
stopifnot(identical(manifest$sha256,sha256_file(path)),manifest$rows==length(rows),identical(sort(numbers(rows)),sort(numbers(written$rows))))
assert_no_postrank();cat('oracle-v3p5-tools:',length(rows),'rows;',length(numbers(rows)),'finite numbers exact17digit roundtrip; base-R-only/no app or TS inputs PASS.\n')
