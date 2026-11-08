# Author: JoonHo Lee (jlee296@ua.edu).
# Population-change UI pins, independently generated from SR-06 and the released synthetic six-site law.
# The small six-site family is enumerated in base R BEFORE postrank is loaded. The league's
# unrestricted-in-order cuts are reproduced by public postrank1.1.0, not the JavaScript implementation.
source("r-export/_paths.R")
source("r-export/_helpers.R")
source("r-export/_oracle.R")
source("r-export/_rng.R")
assert_no_postrank()
vec <- function(x) I(unname(x))
normal_e <- function(m,s) {
 n<-length(m);e<-matrix(NA_real_,n,n)
 for(i in seq_len(n))for(j in seq_len(n))if(i!=j)e[i,j]<-pnorm((m[j]-m[i])/sqrt(s[i]^2+s[j]^2))
 e
}
relations <- function(g,h) {
 a<-sign(outer(g,g,"-"));b<-sign(outer(h,h,"-"));k<-upper.tri(a)
 list(commonPairs=sum(k),changed=sum(a[k]!=b[k]),nSame=sum(a[k]==b[k]),
 nNewWithheld=sum(a[k]!=0 & b[k]==0),nNewDisclosed=sum(a[k]==0 & b[k]!=0),nReversed=sum(a[k]*b[k]<0))
}
metrics <- function(g,e,tau=.2) {
 z<-oracle_report_counts(g,e);list(N=z$N,risk=oracle_risk(g,e,tau))
}
summary <- function(ids,drop,g,h,e0,e1,size0,size1) {
 keep<-which(ids!=drop);a<-metrics(g,e0);b<-metrics(h,e1)
 common<-g[keep];rel<-relations(common,h)
 c(list(beforeGrade=vec(as.integer(g)),afterGrade=vec(as.integer(h)),
 beforeSizes=vec(as.integer(tabulate(g))),afterSizes=vec(as.integer(tabulate(h))),
 beforeN=a$N,afterN=b$N,beforeRisk=a$risk,afterRisk=b$risk,
 beforeFamilySize=size0,afterFamilySize=size1),rel,
 list(untouchedChanged=rel$changed,untouchedPairs=rel$commonPairs,
 coefficientGap=max(abs(e0[keep,keep]-e1),na.rm=TRUE)))
}
six<-jsonlite::fromJSON("data/released/six-sites.json")$tables$units
E<-(normal_e(six$mean_A,six$sd_A)+normal_e(six$mean_B,six$sd_B))/2
best<-function(e){g<-oracle_reports(nrow(e));g<-g[do.call(order,as.data.frame(g)),,drop=FALSE];r<-apply(g,1,oracle_risk,e=e,tau=.2);list(g=as.integer(g[which.min(r),]),size=nrow(g))}
k<-which(six$id!="C");b<-best(E);a<-best(E[k,k]);
args<-list(data="six",score="AB",unit="C",tau=.2,cap="all",ids=vec(six$id),
 means=lapply(seq_along(six$id),function(i)vec(c(six$mean_A[i],six$mean_B[i]))),
 sds=lapply(seq_along(six$id),function(i)vec(c(six$sd_A[i],six$sd_B[i]))),w=vec(c(.5,.5)))
row<-list(id="correction-six-AB-drop-C",args=args,expect=summary(six$id,"C",b$g,a$g,E,E[k,k],b$size,a$size))
# A single corrected mean equals D at tau1/2: preserve every risk-tied report's relation change.
tie_m <- six$mean_A;tie_m[3] <- .15
tie_e0 <- normal_e(six$mean_A,six$sd_A);tie_e1 <- normal_e(tie_m,six$sd_A)
tie_reports <- oracle_reports(6L);tie_reports <- tie_reports[do.call(order,as.data.frame(tie_reports)),,drop=FALSE]
ties <- function(e){r<-apply(tie_reports,1,oracle_risk,e=e,tau=.5);lapply(which(abs(r-min(r))<=1e-12),function(i)as.integer(tie_reports[i,]))}
tie_before <- ties(tie_e0);tie_after <- ties(tie_e1)
tie_comparisons <- list()
for(g in tie_before)for(h in tie_after) {
 rel <- relations(g,h);other <- relations(g[-3],h[-3])
 tie_comparisons[[length(tie_comparisons)+1L]] <- list(beforeGrade=vec(g),afterGrade=vec(h),changed=rel$changed,untouchedChanged=other$changed)
}
tie_row <- list(id="correction-six-A-mean-C-equals-D",args=list(kind="ties",means=vec(six$mean_A),sds=vec(six$sd_A),ids=vec(six$id),unit=2L,value=.15,tau=.5),
 expect=list(beforeGrades=lapply(tie_before,vec),afterGrades=lapply(tie_after,vec),beforeTieCount=length(tie_before),afterTieCount=length(tie_after),comparisons=tie_comparisons))
write_golden("oracle-v3p2-correction",list(row,tie_row),generator="r-export/27_v3_part2_correction.R",uses_postrank=FALSE)

# SR-06 frozen observation at seed20261030 and normal-normal teaching prior SD.15.
i<-1:30;ids<-sprintf("U%02d",i);se<-.8/sqrt(rep(c(16,64,256),10));theta<-.15*qnorm(((19*i)%%31-.5)/30)
estimate<-theta+se*prx_normals(20261030,30);B<-.15^2/(.15^2+se^2);mean<-B*estimate;sd<-sqrt(B)*se
E<-normal_e(mean,sd);dimnames(E)<-list(ids,ids)
fit<-function(e) {
 n<-nrow(e);id<-rownames(e)
 input<-postrank::postrank_probabilities(e,criterion="priority",event="directional_error",zero_ties=TRUE,margin=0,
 source=list(kind="analytic_reference",description="SR-06 frozen simulated league; independent normal-normal teaching posterior",conditioning="Frozen observation, prior mean0 and SD.15"),targets=c(priority="Synthetic league value; larger is higher"))
 er<-setNames(1+rowSums(e,na.rm=TRUE),id)
 settings<-postrank::postrank_settings(c(priority=1),tau=.2,G_max=as.integer(n))
 result<-postrank::postrank_cuts(er,input,settings,direction="ascending",rule="optimal")
 as.integer(result$grade[id])
}
k<-which(ids!="U15");g<-fit(E);h<-fit(E[k,k]);
expect<-summary(ids,"U15",g,h,E,E[k,k],2^(length(ids)-1),2^(length(k)-1))
stopifnot(identical(expect$beforeSizes,vec(c(1L,12L,15L,2L))),identical(expect$afterSizes,vec(c(9L,17L,3L))),
 expect$changed==107,expect$nNewWithheld==62,expect$nNewDisclosed==45,expect$nReversed==0,expect$commonPairs==406)
args<-list(data="league",unit="U15",tau=.2,cap="all",seed=20261030,priorSd=.15)
write_golden("postrank-v3p2-correction",list(list(id="correction-league-drop-U15",args=args,expect=expect)),generator="r-export/27_v3_part2_correction.R",uses_postrank=TRUE)
cat("Population correction pins: independent base-R six-site enumeration and public-package league cuts\n")
print(row$expect);print(expect)
