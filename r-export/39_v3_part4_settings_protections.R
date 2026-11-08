# Author: JoonHo Lee (jlee296@ua.edu).
# Independent Part4 numerical composition pins for settings grids and a
# separately labelled fixed-S IID protection illustration. No app4.10/4.14,
# new TypeScript implementation/tests, JavaScript numerical output, solver,
# browser, network, adaptive sampling or postrank namespace is used.
# Run from repository root: Rscript r-export/39_v3_part4_settings_protections.R
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');source('r-export/_rng.R')
assert_no_postrank()
write_json_stable<-function(x,path){dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE);writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE);invisible(path)}

# Parse only these frozen, independently authored PURE R35 definitions. Do
# not execute its cases, source setup, data reads or writer. Reusing this
# mathematical oracle does not import an app/TS implementation.
pureNames<-c('vec','%or%','Mof','lexsort','gl','earr','uncube','weights','evaluate','change','allreports','familyCache','familyreports','optimum','compare','protection')
found<-character()
for(expr in parse('r-export/35_v3_part4.R'))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pureNames){eval(expr);found<-c(found,as.character(expr[[2]]))}
stopifnot(setequal(found,pureNames));assert_no_postrank()
close<-function(a,b,tol=1e-12){stopifnot(length(a)==length(b),identical(as.logical(is.na(a)),as.logical(is.na(b))),all(abs(a[!is.na(a)]-b[!is.na(b)])<=tol*(1+abs(a[!is.na(a)]))));invisible(TRUE)}
rows<-list();add<-function(id,fn,args,expect)rows[[length(rows)+1L]]<<-list(id=id,args=c(list(fn=fn),args),expect=expect)

# Original installed public tutorial law, without loading its namespace.
# The old1.17 input columns are the released means/SDs. Require those to agree
# exactly here; recompute exact directional probabilities with base-R pnorm,
# rather than using the rounded released coefficient array for IID fixtures.
inputs<-new.env(parent=emptyenv());utils::data(list='pr_tutorial',package='postrank',lib.loc=postrank_lib,envir=inputs)
assert_no_postrank();tu<-inputs$pr_tutorial
means<-unname(tu$law$means);sds<-unname(sqrt(t(apply(tu$law$covariance,3,diag))));ids<-tu$two$entity_ids;criteria<-tu$two$criterion_ids
release<-jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE);units<-release$tables$units
numericColumn<-function(x)vapply(x,as.numeric,0)
releaseMeans<-cbind(numericColumn(units$mean_A),numericColumn(units$mean_B));releaseSds<-cbind(numericColumn(units$sd_A),numericColumn(units$sd_B))
stopifnot(identical(ids,unlist(units$id,use.names=FALSE)),identical(criteria,c('score_A','score_B')),identical(means,unname(releaseMeans)),identical(sds,unname(releaseSds)),identical(dim(means),c(6L,2L)))
n<-nrow(means);K<-ncol(means);M<-Mof(n);stopifnot(M==15,K==2)
normalErrors<-function(){e<-array(NA_real_,c(n,n,K));for(k in seq_len(K))for(i in seq_len(n))for(j in seq_len(n))if(i!=j)e[i,j,k]<-pnorm((means[j,k]-means[i,k])/sqrt(sds[i,k]^2+sds[j,k]^2));earr(e,ids,criteria)}
Eexact<-normalErrors()

# Fixed-size independent Normal states, using the original public seeded
# stream: draw-major, then unit, then criterion. Do NOT round these draws.
# The weak event <= is counted directly, before division by the fixed S.
sampledErrors<-function(S,seed){z<-prx_normals(seed,S*n*K);draws<-array(NA_real_,c(S,n,K));for(s in seq_len(S))for(i in seq_len(n))for(k in seq_len(K))draws[s,i,k]<-means[i,k]+sds[i,k]*z[((s-1L)*n+(i-1L))*K+k]
 e<-array(NA_real_,c(n,n,K));for(k in seq_len(K))for(i in seq_len(n))for(j in seq_len(n))if(i!=j)e[i,j,k]<-sum(draws[,i,k]<=draws[,j,k])/S
 earr(e,ids,criteria)
}
checkComplements<-function(E){e<-uncube(E);for(k in seq_len(K)){a<-e[,,k]+t(e[,,k]);off<-row(a)!=col(a);stopifnot(all(is.na(diag(a))));close(a[off],rep(1,sum(off)),1e-15)};invisible(TRUE)}
checkComplements(Eexact)
iidProtection<-function(S,seed,alpha,q,tau,w,family){Eh<-sampledErrors(S,seed);checkComplements(Eh);epsilon<-rep(sqrt(log(2*M/(alpha/K))/(2*S)),K)
 envelopes<-protection(Eh,Eexact,q,epsilon,tau,w,family,feasibilityTol=0,coefficientTol=1e-12)
 # The probability claim concerns the simultaneous coefficient event under
 # fixed-S IID whole states. These supplied seeds satisfy that event, and
 # actual membership brackets are checked independently by the R35 oracle.
 stopifnot(envelopes$coefficientCheck$strictEnvelopeHolds,envelopes$actualBracketInclusions$innerSubsetExact,envelopes$actualBracketInclusions$exactSubsetOuter,envelopes$actualBracketInclusions$innerSubsetNominal,envelopes$actualBracketInclusions$nominalSubsetOuter)
 list(Ehat=Eh,Eexact=Eexact,epsilon=vec(epsilon),S=S,seed=seed,alpha=alpha,envelopes=envelopes)
}
specs<-list(list(id='S100-cap2-qB03',S=100L,family=list(kind='atMost',G=2L),q=list(NULL,.03)),list(id='S1000-cap2-qB03',S=1000L,family=list(kind='atMost',G=2L),q=list(NULL,.03)),list(id='S4000-cap2-qB03',S=4000L,family=list(kind='atMost',G=2L),q=list(NULL,.03)),list(id='S1000-exact2-qB03',S=1000L,family=list(kind='exactly',G=2L),q=list(NULL,.03)),list(id='S1000-cap2-qB30',S=1000L,family=list(kind='atMost',G=2L),q=list(NULL,.30)))
for(s in specs){args<-list(S=s$S,seed=1L,alpha=.05,q=s$q,tau=.25,w=vec(c(1,0)),family=s$family);ans<-iidProtection(s$S,1L,.05,s$q,.25,c(1,0),s$family);add(paste0('iid-protection-',s$id),'iidProtectionPart4',args,ans)
 stopifnot(ans$envelopes$family$size==if(s$family$kind=='exactly')62L else 63L);cat('iid',s$id,': counts',unlist(ans$envelopes$counts),'epsilon',ans$epsilon[2],'; strict and actual bracket checks PASS\n')}
# The negative inner threshold excludes every N>0 report in the S1000/.03
# case, while at-most2 retains all-withheld as a count-form feasible action.
stopifnot(rows[[2]]$expect$envelopes$innerThreshold[[2]]<0,rows[[2]]$expect$envelopes$counts$inner==1L,rows[[4]]$expect$envelopes$counts$inner==0L,rows[[4]]$expect$envelopes$empty$inner)

# Separately declared deterministic book construction. These are hand-set
# estimated/exact coefficient arrays, not an IID experiment or a sampling
# certificate. Preserve the specified floating operations and signed q+-eps.
bookPair<-function(ab,ba){e<-array(NA_real_,c(2L,2L,1L));e[1,2,1]<-ab;e[2,1,1]<-ba;earr(e,c('A','B'),'c1')}
for(s in list(list(t=.9,epsilon=.1),list(t=.45,epsilon=.1),list(t=.2,epsilon=0),list(t=.2,epsilon=.4))){f<-list(kind='all');Eh<-bookPair(s$t,1-s$t);Ex<-bookPair(s$t+.1,.9-s$t);ans<-protection(Eh,Ex,list(s$t+.05),s$epsilon,.25,1,f,feasibilityTol=0,coefficientTol=1e-12)
 add(paste0('book-protection-t',s$t,'-eps',s$epsilon),'bookProtectionPart4',list(t=s$t,epsilon=s$epsilon,family=f),ans)
 stopifnot(ans$family$size==3L);cat('book t',s$t,'eps',s$epsilon,': counts',unlist(ans$counts),'; raw thresholds',unlist(ans$innerThreshold),unlist(ans$outerThreshold),'\n')}
stopifnot(rows[[6]]$expect$outerThreshold[[1]]>1)
incomparable<-rows[[7]]$expect$rows
stopifnot(any(vapply(incomparable,function(r)r$membership$nominal&&!r$membership$exact,TRUE)),any(vapply(incomparable,function(r)!r$membership$nominal&&r$membership$exact,TRUE)),!rows[[8]]$expect$coefficientCheck$strictEnvelopeHolds,rows[[9]]$expect$innerThreshold[[1]]<0)

# Same SIX coefficient input as frozen R35 settings-six-small-full. Unlike
# the IID route above, this is an explicit released-coefficient settings
# lattice, not a new draw sample. The reference GRADE remains fixed, while
# both fixed reports are reevaluated under EACH ROW'S tau and error weights.
Egrid<-earr(uncube(release$arrays$two),unlist(release$arrays$two$ids,use.names=FALSE),unlist(release$arrays$two$criteria,use.names=FALSE));egrid<-uncube(Egrid)
settingsGrid<-function(taus,caps,ww,referenceId){out<-list()
 for(ti in seq_along(taus))for(ci in seq_along(caps))for(wi in seq_along(ww)){tau<-taus[ti];cap<-caps[ci];w<-ww[[wi]];o<-optimum(egrid,tau,w,list(kind='atMost',G=cap));out[[length(out)+1L]]<-list(id=paste0('tau',ti,'-cap',ci,'-w',wi),tau=tau,cap=cap,w=vec(w),grade=o$grade,grades=o$grades,tieCount=o$tieCount,evaluation=evaluate(as.numeric(o$grade),egrid,tau,w))}
 ix<-which(vapply(out,function(r)r$id==referenceId,TRUE));stopifnot(length(ix)==1L);ref<-out[[ix]];reference<-ref[c('id','grade','tau','cap','w')]
 stopifnot(identical(as.integer(reference$grade),c(1L,1L,1L,1L,2L,3L)))
 for(i in seq_along(out)){r<-out[[i]];out[[i]]$comparison<-compare(as.numeric(reference$grade),as.numeric(r$grade),egrid,r$tau,as.numeric(r$w));stopifnot(identical(out[[i]]$comparison$after,r$evaluation));close(sum(vapply(out[[i]]$comparison$pairs,function(p)p$normalizedDifference,0)),out[[i]]$comparison$deltaRisk)}
 for(ti in seq_along(taus))for(wi in seq_along(ww)){risks<-vapply(seq_along(caps),function(ci)out[[(ti-1L)*length(caps)*length(ww)+(ci-1L)*length(ww)+wi]]$evaluation$risk,0);stopifnot(all(diff(risks)<=1e-12))}
 stopifnot(out[[ix]]$comparison$deltaRisk==0,out[[ix]]$comparison$change$changed==0L,length(out[[ix]]$comparison$pairs)==0L)
 list(reference=reference,rows=out)
}
args<-list(taus=vec(c(.2,.35)),caps=vec(c(1L,2L,3L,6L)),weights=list(vec(c(.5,.5)),vec(c(0,1)),vec(c(1,0))),referenceId='tau1-cap3-w1')
grid<-settingsGrid(unclass(args$taus),unclass(args$caps),lapply(args$weights,unclass),args$referenceId)
stopifnot(length(grid$rows)==24L,!anyDuplicated(vapply(grid$rows,`[[`,'','id')))
add('settings-six-fixed-reference-full','settingsGridPart4',args,grid)
assert_no_postrank();stopifnot(length(rows)==10L,!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3p4-settings-protections',rows,'r-export/39_v3_part4_settings_protections.R',uses_postrank=FALSE)
cat('oracle-v3p4-settings-protections:',length(rows),'rows; five fixed-S IID envelopes, four deterministic book boundaries and one full24row settings lattice; independent base-R self-checks PASS.\n')
