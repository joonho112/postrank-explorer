# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R oracle for all approved Phase7 numerical contracts.
# See the multiple-criteria contracts in engine/API.md and the repository README;
# public theory book ch11--16/19, public R/protection-envelopes.R, and released
# six-sites/case-krw coefficients. No postrank namespace, new TS implementation,
# TS tests, app numerical source, solver, browser, network or timing is used.
# Run from repository root: Rscript r-export/35_v3_part4.R
source('r-export/_paths.R'); source('r-export/_helpers.R'); source('r-export/_oracle.R')
assert_no_postrank()
# The shared writer's digits=NA rounds to 15 significant figures. These new
# floating-boundary pins require round-tripping every double, including actual
# maxAbs=.10000000000000009. Keep write_golden/manifest generation unchanged;
# specialize only its serialization dependency for this producer.
write_json_stable <- function(x,path) {
 dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE)
 writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE)
 invisible(path)
}
vec <- function(x) I(unname(x))
`%or%` <- function(x,y) if(is.null(x))y else x
Mof <- function(n) n*(n-1)/2
rows <- list(); checks <- list()
add <- function(id,fn,args,expect) rows[[length(rows)+1L]] <<- list(id=id,args=c(list(fn=fn),args),expect=expect)
close <- function(a,b,tol=1e-12) stopifnot(length(a)==length(b),max(c(0,abs(a-b)),na.rm=TRUE)<tol)
lexsort <- function(G) if(nrow(G))G[do.call(order,unname(as.data.frame(G))),,drop=FALSE]else G
gl <- function(G) lapply(seq_len(nrow(G)),function(i)vec(G[i,]))
earr <- function(e,ids=NULL,criteria=NULL) {
 if(length(dim(e))==2L)e<-array(e,c(nrow(e),ncol(e),1L))
 n<-dim(e)[1];K<-dim(e)[3]
 list(ids=vec(ids %or% if(n<=26)LETTERS[seq_len(n)]else sprintf('U%02d',seq_len(n))),criteria=vec(criteria %or% paste0('c',seq_len(K))),e=lapply(seq_len(K),function(k)unname(e[,,k])))
}
uncube <- function(E) {
 n<-length(E$ids);K<-length(E$criteria);out<-array(NA_real_,c(n,n,K))
 for(k in seq_len(K))out[,,k]<-do.call(rbind,lapply(E$e[[k]],function(v)if(is.list(v))vapply(v,function(x)x %or% NA_real_,0)else v))
 out
}
from_released <- function(x) {e<-uncube(x);earr(e,unlist(x$ids),unlist(x$criteria))}
pairlist <- function(n) {z<-which(upper.tri(matrix(0,n,n)),arr.ind=TRUE);z[order(z[,1],z[,2]),,drop=FALSE]}
weights <- function(w,K) w %or% rep(1/K,K)
evaluate <- function(g,e,tau,w=NULL) {
 K<-dim(e)[3];n<-length(g);M<-Mof(n);w<-weights(w,K);st<-outer(g,g,'<');N<-sum(st)
 Ek<-vapply(seq_len(K),function(k)sum(e[,,k][st]),0);Ew<-sum(w*Ek);withhold<-tau*(M-N)/M
 list(M=M,N=N,s=N/M,G=length(unique(g)),E=vec(Ek),EoverN=if(N)vec(Ek/N)else rep(list(NULL),K),EoverM=vec(Ek/M),Rk=vec(Ek/M+withhold),Ew=Ew,risk=Ew/M+withhold,errorTerm=Ew/M,withholdingTerm=withhold)
}
change <- function(g0,g1,e,w=NULL) {
 n<-length(g0);M<-Mof(n);K<-dim(e)[3];w<-weights(w,K);ct<-c(nSame=0L,nNewDisclosed=0L,nNewWithheld=0L,nReversed=0L);out<-list();nm<-c('below','withheld','above')
 for(i in seq_len(n-1))for(j in (i+1):n){a<-sign(g0[j]-g0[i]);b<-sign(g1[j]-g1[i]);key<-if(a==b)'nSame'else if(a==0)'nNewDisclosed'else if(b==0)'nNewWithheld'else 'nReversed';ct[key]<-ct[key]+1L
  if(a!=b)out[[length(out)+1L]]<-list(i=i-1L,j=j-1L,from=nm[a+2],to=nm[b+2],error=if(b==0)NULL else if(b==1)sum(w*e[i,j,])else sum(w*e[j,i,]))}
 c(list(M=M),as.list(ct),list(agreement=ct['nSame']/M,pairs=out,changed=M-ct['nSame'],changeShare=(M-ct['nSame'])/M))
}
allreports <- local({cache<-new.env();function(n){key<-as.character(n);if(!exists(key,cache,inherits=FALSE))assign(key,lexsort(oracle_reports(n)),cache);get(key,cache)}})
familyCache <- new.env(parent=emptyenv())
familyreports <- function(n,f=list(kind='all')) {
 if(f$kind!='order') {key<-paste(n,f$kind,f$G,sep=':');if(exists(key,familyCache,inherits=FALSE))return(get(key,familyCache));if(f$kind%in%c('atMost','exactly')&&f$G<n)G<-lexsort(oracle_reports(n,f$G))else G<-allreports(n);if(f$kind=='atMost')G<-G[apply(G,1,max)<=f$G,,drop=FALSE];if(f$kind=='exactly')G<-G[apply(G,1,max)==f$G,,drop=FALSE];assign(key,G,familyCache);return(G)}
 order1<-unclass(f$order)+1L;blocks<-f$blocks %or% rep(1L,n);B<-length(blocks);boundary<-cumsum(blocks)[-B];hs<-f$exact %or% seq_len(min(f$G %or% B,B));hs<-hs[hs>=1&hs<=B];out<-list()
 for(h in hs){cc<-if(h==1)list(integer())else combn(B-1,h-1,simplify=FALSE);for(ix in cc){g<-integer(n);g[order1]<-1L+findInterval(seq_len(n)-1L,boundary[ix]);out[[length(out)+1L]]<-g}}
 if(length(out))lexsort(do.call(rbind,out))else matrix(integer(),0,n)
}
optimum <- function(e,tau,w=NULL,f=list(kind='all'),maxTies=100L,tieTol=1e-12,G=NULL) {
 if(is.null(G))G<-familyreports(dim(e)[1],f)
 if(!nrow(G))return(list(empty=TRUE))
 n<-ncol(G);ww<-weights(w,dim(e)[3]);raw<-numeric(nrow(G))
 for(i in seq_len(n-1))for(j in (i+1):n)raw<-raw+ifelse(G[,i]<G[,j],sum(ww*e[i,j,]),ifelse(G[,j]<G[,i],sum(ww*e[j,i,]),tau))
 risk<-raw/Mof(n);ix<-which(risk<=min(risk)+tieTol);tied<-G[ix,,drop=FALSE];chosen<-1L
 if(f$kind=='order') {ng<-apply(tied,1,max);candidates<-which(ng==min(ng));cutkey<-lapply(candidates,function(i)which(diff(tied[i,unclass(f$order)+1L])>0));if(length(candidates)>1){cm<-do.call(rbind,cutkey);chosen<-candidates[do.call(order,unname(as.data.frame(cm)))[1]]}else chosen<-candidates}
 g<-tied[chosen,];list(empty=FALSE,grade=vec(g),grades=gl(head(tied,maxTies)),tieCount=length(ix),risk=evaluate(g,e,tau,w)$risk)
}
optbrief <- function(o) o[c('grade','grades','tieCount','risk')]

# Independently aggregate whole states: equality is wrong in BOTH directions.
finite <- function(states,p=NULL,ids=NULL,criteria=NULL) {
 S<-length(states);p<-p %or% rep(1/S,S);n<-nrow(states[[1]]);K<-ncol(states[[1]]);e<-pi<-t<-array(NA_real_,c(n,n,K))
 for(k in seq_len(K))for(i in seq_len(n))for(j in seq_len(n))if(i!=j){v<-vapply(states,function(s)s[i,k]-s[j,k],0);e[i,j,k]<-sum(p[v<=0]);pi[i,j,k]<-sum(p[v>0]);t[i,j,k]<-sum(p[v==0])}
 out<-earr(e,ids,criteria);out$pi<-earr(pi)$e;out$t<-earr(t)$e;out
}
wrong <- function(g,states,p=NULL,w=NULL) {
 S<-length(states);p<-p %or% rep(1/S,S);K<-ncol(states[[1]]);w<-weights(w,K);n<-length(g);D<-matrix(0,S,K);N<-0L
 for(i in seq_len(n-1))for(j in (i+1):n)if(g[i]!=g[j]){N<-N+1L;a<-if(g[i]<g[j])i else j;b<-if(a==i)j else i
  for(s in seq_len(S))D[s,]<-D[s,]+as.numeric(states[[s]][a,]<=states[[s]][b,])}
 A<-vapply(seq_len(S),function(s)sum(w*D[s,]),0);values<-sort(unique(A));pr<-vapply(values,function(a)sum(p[A==a]),0)
 list(N=N,values=vec(values),probs=vec(pr),expected=sum(p*A),pNone=sum(p[A==0]),pAllCriteriaRight=sum(p[rowSums(D)==0]),unionBound=max(0,1-sum(p*rowSums(D))))
}

# Decimal addition only, independent of BigInt/JavaScript/R packages. Used for
# all feasible order-partition counts, including 97-unit uncapped families.
decadd <- function(a,b) {
 aa<-rev(as.integer(strsplit(a,'',fixed=TRUE)[[1]]));bb<-rev(as.integer(strsplit(b,'',fixed=TRUE)[[1]]));L<-max(length(aa),length(bb));length(aa)<-length(bb)<-L;aa[is.na(aa)]<-bb[is.na(bb)]<-0L;c<-0L;out<-integer(L)
 for(i in seq_len(L)){z<-aa[i]+bb[i]+c;out[i]<-z%%10;c<-z%/%10};if(c)out<-c(out,c);paste(rev(out),collapse='')
}
decsum <- function(x) Reduce(decadd,x,init='0')
countjson <- function(s) if(nchar(s)<16L||(nchar(s)==16L&&s<='9007199254740991'))as.numeric(s)else s
normal_pairs <- function(stating) {
 if(!length(stating))return(list());z<-unique(do.call(rbind,stating));lapply(seq_len(nrow(z)),function(i)vec(as.integer(z[i,])))
}
# Independent segment-cost DP. A grade partition costs its fully strict order
# cost plus the sum of (tau-e_ab) inside its grade segments. Required endpoints
# may not share a segment. Counts run on a separate decimal-valued recurrence.
orderdp <- function(e,tau,w,f,stating=list(),maxTies=100L,tieTol=1e-12) {
 n<-dim(e)[1];M<-Mof(n);o<-unclass(f$order)+1L;bl<-as.integer(f$blocks %or% rep(1L,n));B<-length(bl);bd<-c(0L,cumsum(bl));pos<-integer(n);pos[o]<-seq_len(n);stating<-normal_pairs(stating)
 allowed<-matrix(FALSE,B,B);seg<-matrix(0,B,B);strict<-0
 for(a in seq_len(n-1))for(b in (a+1):n)strict<-strict+sum(w*e[o[a],o[b],])
 badOrder<-any(vapply(stating,function(ij)pos[ij[1]+1L]>=pos[ij[2]+1L],TRUE))
 for(l in seq_len(B))for(r in l:B){units<-o[(bd[l]+1L):bd[r+1L]];allowed[l,r]<-!badOrder&&!any(vapply(stating,function(ij)all((ij+1L) %in% units),TRUE));v<-0
  if(length(units)>1)for(a in seq_len(length(units)-1))for(b in (a+1):length(units))v<-v+tau-sum(w*e[units[a],units[b],]);seg[l,r]<-v}
 H<-min(f$exact %or% f$G %or% B,B);hs<-if(!is.null(f$exact))f$exact else seq_len(H);hs<-hs[hs>=1&hs<=B]
 if(!length(hs))return(list(empty=TRUE,count='0',baseCount=if(!is.null(f$exact)&&f$exact>B)'0'else NULL))
 V<-matrix(Inf,H+1,B+1);V[1,1]<-0;count<-matrix('0',H+1,B+1);count[1,1]<-'1';base<-count;pred<-vector('list',(H+1)*(B+1));slot<-function(h,r)h*(B+1)+r+1L
 for(h in seq_len(H))for(r in seq_len(B))if(r>=h){bs<-(h-1):(r-1);ok<-vapply(bs,function(b)allowed[b+1,r],TRUE);count[h+1,r+1]<-decsum(count[h,bs[ok]+1]);base[h+1,r+1]<-decsum(base[h,bs+1]);valid<-bs[ok&is.finite(V[h,bs+1])]
  if(length(valid)){cost<-V[h,valid+1]+seg[cbind(valid+1,r)];V[h+1,r+1]<-min(cost);pred[[slot(h,r)]]<-valid[cost<=min(cost)+tieTol*M]}}
 total<-decsum(count[hs+1,B+1]);baseTotal<-decsum(base[hs+1,B+1]);if(total=='0')return(list(empty=TRUE,count=total,baseCount=baseTotal))
 best<-min(V[hs+1,B+1]);bestH<-hs[V[hs+1,B+1]<=best+tieTol*M]
 # Count all optimal complete paths without materializing them.
 nt<-matrix('0',H+1,B+1);nt[1,1]<-'1'
 for(h in seq_len(H))for(r in seq_len(B))if(length(pred[[slot(h,r)]]))nt[h+1,r+1]<-decsum(nt[h,pred[[slot(h,r)]]+1])
 ntotal<-decsum(nt[bestH+1,B+1]);tied<-list();walk<-function(h,r,cuts=integer()){
  if(h==0){g<-integer(n);g[o]<-1L+findInterval(seq_len(n)-1L,bd[sort(cuts)+1L]);tied[[length(tied)+1L]]<<-g;return(invisible(NULL))}
  for(b in pred[[slot(h,r)]])walk(h-1,b,if(b>0)c(b,cuts)else cuts)
 }
 stopifnot(as.numeric(ntotal)*n<=2e7) # all selected real-data laws have small optimal tie sets
 for(h in bestH)walk(h,B)
 T<-lexsort(do.call(rbind,tied));stopifnot(nrow(T)==as.numeric(ntotal));ng<-apply(T,1,max);cand<-which(ng==min(ng));cc<-lapply(cand,function(i)which(diff(T[i,o])>0));choice<-if(length(cand)==1)cand else cand[do.call(order,unname(as.data.frame(do.call(rbind,cc))))[1]];g<-T[choice,];cut<-which(diff(g[o])>0);bc<-match(cut,bd[-c(1,length(bd))]);ev<-evaluate(g,e,tau,w)
 list(empty=FALSE,count=total,baseCount=baseTotal,grade=vec(g),grades=gl(head(T,maxTies)),gradesOrder='lexicographic',tieCount=countjson(ntotal),risk=ev$risk,N=ev$N,G=ev$G,Ew=ev$Ew,E=ev$E,EoverN=ev$EoverN,evaluation=ev,order=vec(o-1L),blocks=vec(bl),cuts=vec(cut),blockCuts=vec(bc),saving=sum(vapply(split(seq_len(n),g[o]),function(x){v<-0;if(length(x)>1)for(a in seq_len(length(x)-1))for(b in (a+1):length(x))v<-v+sum(w*e[o[x[a]],o[x[b]],])-tau;v},0)))
}
constrained <- function(e,tau,w=NULL,f=list(kind='all'),stating=list(),maxTies=100L,tieTol=1e-12) {
 n<-dim(e)[1];w<-weights(w,dim(e)[3]);s<-normal_pairs(stating);isOrder<-f$kind=='order'
 if(isOrder){o<-orderdp(e,tau,w,f,s,maxTies,tieTol);size<-countjson(o$count);baseSize<-countjson(o$baseCount);o$count<-o$baseCount<-NULL}
 else {base<-familyreports(n,f);ok<-rep(TRUE,nrow(base));for(ij in s)ok<-ok&base[,ij[1]+1L]<base[,ij[2]+1L];G<-base[ok,,drop=FALSE];size<-nrow(G);baseSize<-nrow(base);o<-optimum(e,tau,w,f,maxTies,tieTol,G)
  if(!o$empty){ev<-evaluate(o$grade,e,tau,w);o<-c(o,ev[c('N','G','Ew','E','EoverN')],list(evaluation=ev))}}
 contains<-!length(s)&&(is.null(f$exact)||f$exact<=1)&&(f$kind!='exactly'||f$G<=1)
 o$familySize<-size;o$baseSize<-baseSize;o$baseFamilySize<-baseSize;o$stating<-s;o$containsAllWithheld<-contains&&!o$empty
 if(!o$empty)o$tieTol<-tieTol
 o$label<-if(isOrder)'optimal-within-order'else 'exact-within-family';o$familyNamePreserved<-TRUE;o$familyWordsPreserved<-TRUE;o
}

# Released six-site law; input errors stay at their released precision, rather
# than silently replacing coefficients with a different normal calculation.
six<-jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE);E6<-from_released(six$arrays$two);e6<-uncube(E6)
m6<-cbind(unlist(six$tables$units$mean_A),unlist(six$tables$units$mean_B));sd6<-cbind(unlist(six$tables$units$sd_A),unlist(six$tables$units$sd_B))
Ehalf<-function(n,K=1L) {x<-array(.5,c(n,n,K));for(k in seq_len(K))diag(x[,,k])<-NA_real_;earr(x)}
pairE<-function(ab,ba=1-ab,criteria=NULL){K<-length(ab);e<-array(NA_real_,c(2,2,K));e[1,2,]<-ab;e[2,1,]<-ba;earr(e,criteria=criteria)}

# 1. Smaller directional cost excludes withholding (and is not E[gamma]).
for(z in list(c(.5,.5,.2),c(.6,.9,.25),c(.4,.6,.2),c(0,1,.3),c(.5,.5,.5),c(1,1,.25))){cost<-c(iAboveJ=z[1],jAboveI=z[2],withhold=z[3]);add(paste0('directional-min-',length(rows)+1L),'pairDecisionPart4',list(eIJ=z[1],eJI=z[2],tau=z[3]),list(costs=as.list(cost),best=vec(names(cost)[cost<=min(cost)+1e-12]),directionalMinimum=min(z[1:2])))}

# 2. Independent Normal composite law, including deterministic equal scores.
normalComposite <- function(means,sds,a,multiplier=NULL,ids=NULL){b<-a*(multiplier %or% rep(1,ncol(means)));m<-drop(means%*%b);sd<-sqrt(rowSums(sweep(sds,2,b,'*')^2));n<-length(m);e<-matrix(NA_real_,n,n)
 for(i in seq_len(n))for(j in seq_len(n))if(i!=j){d<-sqrt(sd[i]^2+sd[j]^2);e[i,j]<-if(d==0)as.numeric(m[i]<=m[j])else pnorm((m[j]-m[i])/d)}
 list(mean=vec(m),sd=vec(sd),E=earr(e,ids,'composite'))}
normal_specs<-list(list(id='six-balanced',means=m6,sds=sd6,a=c(.5,.5),ids=LETTERS[1:6]),list(id='six-scaleB01',means=m6,sds=sd6,a=c(.5,.5),multiplier=c(1,.1)),list(id='six-scaleA01',means=m6,sds=sd6,a=c(.5,.5),multiplier=c(.1,1)),list(id='general-signed',means=rbind(c(2,-1,4),c(-3,2,0),c(1,1,1)),sds=rbind(c(1,0,.5),c(0,2,1),c(.25,.5,0)),a=c(-2,.25,1.5),multiplier=c(.5,3,2),ids=c('u','10','site C')),list(id='deterministic-ties',means=rbind(c(1,-1),c(0,0),c(2,0)),sds=matrix(0,3,2),a=c(.5,.5)),list(id='all-zero-coefficients',means=m6,sds=sd6,a=c(0,0)),list(id='one-criterion-mixed-degenerate',means=matrix(c(0,0,1),3,1),sds=matrix(c(0,0,.5),3,1),a=-1))
for(s in normal_specs){id<-s$id;s$id<-NULL;out<-do.call(normalComposite,s);a<-list(means=unname(s$means),sds=unname(s$sds),options=list(a=vec(s$a)));if(!is.null(s$multiplier))a$options$multiplier<-vec(s$multiplier);if(!is.null(s$ids))a$options$ids<-vec(s$ids);add(paste0('normal-composite-',id),'normalComposite',a,out)}
close(rows[[7]]$expect$E$e[[1]][2,3],pnorm(-.5))

# 3. Alternative common minimizers each get their OWN criterion evaluations.
commonality <- function(e,tau,w,f,maxTies=100L,tieTol=1e-12){co<-optimum(e,tau,w,f,maxTies,tieTol);K<-dim(e)[3];own<-lapply(seq_len(K),function(k)optimum(e,tau,as.numeric(seq_len(K)==k),f,maxTies,tieTol));cr<-lapply(seq_len(K),function(k){ev<-evaluate(co$grade,e,tau,w);ag<-change(own[[k]]$grade,co$grade,e,w)$agreement;list(ownGrade=own[[k]]$grade,ownGrades=own[[k]]$grades,ownTieCount=own[[k]]$tieCount,ownRk=own[[k]]$risk,delta=max(0,ev$Rk[k]-own[[k]]$risk),relationAgreement=unname(ag))});reports<-lapply(co$grades,function(g){ev<-evaluate(g,e,tau,w);list(grade=g,Rk=ev$Rk,delta=vec(vapply(seq_len(K),function(k)max(0,ev$Rk[k]-own[[k]]$risk),0)),relationAgreement=vec(vapply(seq_len(K),function(k)change(own[[k]]$grade,g,e,w)$agreement,0)))})
 list(common=optbrief(co),criteria=cr,commonReports=reports)}
for(w in list(c(.5,.5),c(0,1),c(1,0))){f<-list(kind='atMost',G=3L);a<-list(E=E6,options=list(tau=.2,w=vec(w),family=f));add(paste0('commonality-six-w',paste(w,collapse='-')),'commonalityPart4',a,commonality(e6,.2,w,f))}
add('commonality-six-w0-maxTies1','commonalityPart4',list(E=E6,options=list(tau=.2,w=vec(c(0,1)),family=list(kind='atMost',G=3L),maxTies=1L)),commonality(e6,.2,c(0,1),list(kind='atMost',G=3L),1L))
add('commonality-full-ties-truncated','commonalityPart4',list(E=Ehalf(3,2),options=list(tau=.5,w=vec(c(0,1)),family=list(kind='all'),maxTies=4L)),commonality(uncube(Ehalf(3,2)),.5,c(0,1),list(kind='all'),4L))

# 4. Exact lower-envelope maximum by half-plane intersection of ALL affine
# report risks. No sampled weight or grid is used for the scientific value.
envelope <- function(e,tau,f,tieTol=1e-12){G<-familyreports(dim(e)[1],f);if(!nrow(G))return(list(empty=TRUE));R<-t(apply(G,1,function(g)evaluate(g,e,tau,c(.5,.5))$Rk));b<-R[,2];a<-R[,1]-b;pieces<-list()
 for(i in seq_len(nrow(G))){d<-a[i]-a;rhs<-b-b[i];lo<-max(c(0,rhs[d<0]/d[d<0]));hi<-min(c(1,rhs[d>0]/d[d>0]));parallelBad<-any(d==0&rhs<0)
  if(!parallelBad&&lo<=hi+1e-14&&hi>=0&&lo<=1){lo<-max(0,lo);hi<-min(1,hi);if(hi<lo)hi<-lo;pieces[[length(pieces)+1L]]<-list(from=lo,to=hi,a=a[i],b=b[i])}}
 peak<-max(vapply(pieces,function(p)max(p$b+p$a*c(p$from,p$to)),0));sets<-list()
 for(p in pieces){if(p$a==0&&abs(p$b-peak)<=tieTol)sets[[length(sets)+1L]]<-c(p$from,p$to)else for(x in c(p$from,p$to))if(abs(p$b+p$a*x-peak)<=tieTol)sets[[length(sets)+1L]]<-c(x,x)}
 T<-do.call(rbind,sets);T<-T[order(T[,1],T[,2]),,drop=FALSE];merged<-list();for(i in seq_len(nrow(T))){z<-T[i,];L<-length(merged);if(L&&z[1]<=merged[[L]][2]+1e-13)merged[[L]][2]<-max(z[2],merged[[L]][2])else merged[[L+1L]]<-z}
 list(empty=FALSE,envelopeMaximum=list(risk=peak,intervals=lapply(merged,function(z)list(from=z[1],to=z[2])),tieTol=tieTol))}
for(s in list(list(id='six-cap3',E=E6,tau=.2,f=list(kind='atMost',G=3L)),list(id='six-all',E=E6,tau=.35,f=list(kind='all')),list(id='six-exact3',E=E6,tau=.2,f=list(kind='exactly',G=3L)),list(id='chapter13-flat',E=pairE(c(0,.5)),tau=.25,f=list(kind='all')),list(id='constant',E=Ehalf(3,2),tau=.25,f=list(kind='all')),list(id='isolated-peak',E=pairE(c(0,1)),tau=.5,f=list(kind='all')),list(id='endpoint',E=pairE(c(.1,.4)),tau=.5,f=list(kind='all')),list(id='empty',E=E6,tau=.2,f=list(kind='exactly',G=7L))))add(paste0('weight-maximum-',s$id),'weightMaximumPart4',list(E=s$E,options=list(tau=s$tau,family=s$f)),envelope(uncube(s$E),s$tau,s$f))

# 5. Signed fixed-report comparison, every changed unordered pair retained.
compare <- function(g0,g1,e,tau,w=NULL){w<-weights(w,dim(e)[3]);before<-evaluate(g0,e,tau,w);after<-evaluate(g1,e,tau,w);pairs<-list();n<-length(g0);M<-Mof(n)
 cost<-function(i,j,r)if(r==0)tau else if(r>0)sum(w*e[i,j,])else sum(w*e[j,i,])
 for(i in seq_len(n-1))for(j in (i+1):n){r0<-sign(g0[j]-g0[i]);r1<-sign(g1[j]-g1[i]);if(r0!=r1){c0<-cost(i,j,r0);c1<-cost(i,j,r1);pairs[[length(pairs)+1L]]<-list(i=i-1L,j=j-1L,beforeRelation=r0,afterRelation=r1,beforeCost=c0,afterCost=c1,costDifference=c1-c0,normalizedDifference=(c1-c0)/M)}}
 out<-list(before=before,after=after,deltaRisk=after$risk-before$risk,errorTermDelta=(after$Ew-before$Ew)/M,withholdingTermDelta=tau*(before$N-after$N)/M,change=change(g0,g1,e,w),pairs=pairs);close(sum(vapply(pairs,function(p)p$normalizedDifference,0)),out$deltaRisk);out}
for(s in list(list(id='identity',g0=c(1,1,2,2,3,3),g1=c(1,1,2,2,3,3)),list(id='relabeled-identity',g0=c(2,2,7,7,9,9),g1=c(1,1,2,2,3,3)),list(id='all-change-types',g0=c(1,1,2,2,3,3),g1=c(3,2,2,1,3,1)),list(id='negative-signed',g0=6:1,g1=rep(1,6)),list(id='withheld-to-optimal',g0=rep(1,6),g1=c(1,1,1,1,2,3))))add(paste0('compare-',s$id),'compareReports',list(g0=vec(s$g0),g1=vec(s$g1),E=E6,options=list(tau=.2,w=vec(c(.5,.5)))),compare(s$g0,s$g1,e6,.2,c(.5,.5)))

# 6. Pair-constrained exact families, and an independent constrained order DP.
chapter19<-list(rbind(c(4,4),c(3,2),c(2,3),c(1,1)),rbind(c(3,1),c(4,2),c(2,3),c(1,4)));p19<-c(.75,.25);E19<-finite(chapter19,p19);e19<-uncube(E19)
conadd<-function(id,E,opts,data=NULL,criterion=NULL){a<-list(E=E,options=opts);if(!is.null(data)){a$E<-NULL;a$data<-data;a$criterion<-criterion};e<-if(is.null(data))uncube(E)else E;add(paste0('constrained-',id),'pairConstrainedOptimum',a,constrained(e,opts$tau,opts$w,opts$family %or% list(kind='all'),opts$stating %or% list(),opts$maxTies %or% 100L,opts$tieTol %or% 1e-12))}
for(s in list(list(id='chapter19-base',stating=list()),list(id='chapter19-B-above-C',stating=list(c(1L,2L))),list(id='chapter19-C-above-B',stating=list(c(2L,1L))),list(id='chapter19-duplicates',stating=list(c(1L,2L),c(1L,2L))),list(id='chapter19-contradiction',stating=list(c(1L,2L),c(2L,1L))),list(id='chapter19-cycle',stating=list(c(0L,1L),c(1L,2L),c(2L,0L)))))conadd(s$id,E19,list(tau=.2,w=vec(c(.6,.4)),stating=lapply(s$stating,vec)))
conadd('chapter19-two-required-directions',E19,list(tau=.2,w=vec(c(.6,.4)),stating=list(vec(c(0L,1L)),vec(c(2L,3L)))))
conadd('chapter19-unsorted-duplicates-first-occurrence',E19,list(tau=.2,w=vec(c(.6,.4)),stating=list(vec(c(2L,3L)),vec(c(0L,1L)),vec(c(2L,3L)),vec(c(0L,1L)))))
for(s in list(list(id='six-coherence-all',f=list(kind='all'),stating=list(c(0L,1L))),list(id='six-cap3',f=list(kind='atMost',G=3L),stating=list(c(0L,1L))),list(id='six-exact3',f=list(kind='exactly',G=3L),stating=list(c(0L,1L))),list(id='six-exact1-empty',f=list(kind='exactly',G=1L),stating=list(c(0L,1L))),list(id='six-empty-base',f=list(kind='exactly',G=7L),stating=list())))conadd(s$id,E6,list(tau=.2,w=vec(c(.5,.5)),family=s$f,stating=lapply(s$stating,vec)))
conadd('half-full-minimizers-truncated',Ehalf(4),list(tau=.5,stating=list(vec(c(0L,1L))),maxTies=3L))
# Largest approved enumerable family: all 523,251 CDE12 reports with cap3.
# The letter-F/I presentation identifies indices 5/8 in the fixed source order.
cde<-jsonlite::fromJSON(file.path(released_dir,'case-cde.json'),simplifyVector=FALSE);EC<-from_released(cde$arrays$error)
for(s in list(list(id='cde12-cap3-baseline',stating=list()),list(id='cde12-cap3-F-above-I',stating=list(vec(c(5L,8L)))),list(id='cde12-cap3-I-above-F',stating=list(vec(c(8L,5L))))))conadd(s$id,EC,list(tau=.25,family=list(kind='atMost',G=3L),stating=s$stating))
order_specs<-list(list(id='small-no-constraints',f=list(kind='order',order=vec(0:3)),s=list()),list(id='small-cap3',f=list(kind='order',order=vec(0:3),G=3L),s=list(c(1L,2L))),list(id='small-exact3',f=list(kind='order',order=vec(0:3),exact=3L),s=list(c(0L,3L))),list(id='small-reverse-infeasible',f=list(kind='order',order=vec(3:0)),s=list(c(0L,1L))),list(id='small-reverse-feasible',f=list(kind='order',order=vec(3:0),G=3L),s=list(c(3L,0L))),list(id='small-blocks-feasible',f=list(kind='order',order=vec(0:3),blocks=vec(c(1L,2L,1L))),s=list(c(0L,2L))),list(id='small-blocks-impossible',f=list(kind='order',order=vec(0:3),blocks=vec(c(1L,2L,1L))),s=list(c(1L,2L))),list(id='small-exact-too-large',f=list(kind='order',order=vec(0:3),blocks=vec(c(1L,2L,1L)),exact=4L),s=list()))
order_specs<-c(order_specs,list(list(id='small-crossing-required-pairs',f=list(kind='order',order=vec(0:3),G=3L),s=list(c(0L,2L),c(1L,3L))),list(id='small-nested-required-pairs',f=list(kind='order',order=vec(0:3)),s=list(c(0L,3L),c(1L,2L)))))
for(s in order_specs){o<-constrained(e19,.25,c(.6,.4),s$f,s$s);G<-familyreports(4,s$f);ok<-if(nrow(G))apply(G,1,function(g)all(vapply(s$s,function(ij)g[ij[1]+1]<g[ij[2]+1],TRUE)))else logical();brute<-optimum(e19,.25,c(.6,.4),s$f,G=G[ok,,drop=FALSE]);stopifnot(o$familySize==sum(ok),o$empty==brute$empty);if(!o$empty){close(o$risk,brute$risk);stopifnot(identical(unclass(o$grade),unclass(brute$grade)),identical(o$grades,brute$grades),o$tieCount==brute$tieCount)};conadd(s$id,E19,list(tau=.25,w=vec(c(.6,.4)),family=s$f,stating=lapply(s$s,vec)))}
for(s in list(list(id='order-half-fullties',f=list(kind='order',order=vec(0:4)),stating=list(vec(c(0L,4L)))),list(id='order-half-exact3',f=list(kind='order',order=vec(0:4),exact=3L),stating=list(vec(c(1L,3L)))),list(id='order-half-duplicates',f=list(kind='order',order=vec(0:4),G=3L),stating=list(vec(c(0L,3L)),vec(c(0L,3L))))))conadd(s$id,Ehalf(5),list(tau=.5,family=s$f,stating=s$stating,maxTies=5L))

# Actual released KRW97 expected-rank order, NEW declared producer. These are
# never compared to an archived report or claimed to be unrestricted optima.
krw<-jsonlite::fromJSON(file.path(released_dir,'case-krw.json'),simplifyVector=FALSE);EK<-from_released(krw$arrays$error);ek<-uncube(EK);idsK<-unlist(EK$ids)
stopifnot(dim(ek)[1]==97L,identical(as.character(EK$criteria),c('race_signed','gender_signed')))
rankK<-1+rowSums(.5*ek[,,1]+.5*ek[,,2],na.rm=TRUE);ordK<-order(rankK,idsK,method='radix')-1L;stopifnot(!anyDuplicated(rankK))
krwbase<-NULL
for(cap in list(4L,NULL)){f<-list(kind='order',order=vec(ordK));if(!is.null(cap))f$G<-cap;tag<-if(is.null(cap))'uncapped'else 'cap4';base<-constrained(ek,.25,c(.5,.5),f);if(is.null(cap))stopifnot(is.character(base$familySize),base$familySize=='79228162514264337593543950336')
 if(!is.null(cap))krwbase<-base
 # One neighboring pair withheld by the cap4 baseline, then both directions.
 if(is.null(krwbase$selectedPair)){positions<-which(diff(unclass(krwbase$grade)[ordK+1L])==0);pick<-positions[ceiling(length(positions)/2)];krwbase$selectedPair<-c(ordK[pick],ordK[pick+1L])}
 pair<-krwbase$selectedPair
 conadd(paste0('krw97-',tag,'-baseline'),ek,list(tau=.25,w=vec(c(.5,.5)),family=f),data='krw',criterion='both')
 conadd(paste0('krw97-',tag,'-stated'),ek,list(tau=.25,w=vec(c(.5,.5)),family=f,stating=list(vec(pair))),data='krw',criterion='both')
 conadd(paste0('krw97-',tag,'-reverse-empty'),ek,list(tau=.25,w=vec(c(.5,.5)),family=f,stating=list(vec(rev(pair)))),data='krw',criterion='both')}
checks$krwOrder<-vec(ordK);checks$krwSelectedPair<-vec(krwbase$selectedPair)

# 7. Protection envelopes: actual count-memberships are computed separately
# from strict/advisory directional coefficient comparisons, with signed q-eps.
protection <- function(Ehat,Eexact,q,epsilon,tau,w=NULL,f=list(kind='all'),feasibilityTol=0,coefficientTol=1e-12){eh<-uncube(Ehat);ex<-uncube(Eexact);K<-dim(eh)[3];w<-weights(w,K);ep<-rep(epsilon,length.out=K);active<-!vapply(q,is.null,TRUE);qv<-vapply(q,function(z)z %or% NA_real_,0);inner<-qv-ep;outer<-qv+ep;th<-list(inner=inner,nominal=qv,exact=qv,outer=outer);G<-familyreports(dim(eh)[1],f);rr<-list()
 for(i in seq_len(nrow(G))){g<-G[i,];he<-evaluate(g,eh,tau,w);xe<-evaluate(g,ex,tau,w);sl<-me<-list();for(key in names(th)){E<-if(key=='exact')xe$E else he$E;v<-th[[key]]*he$N-E;sl[[key]]<-lapply(seq_len(K),function(k)if(active[k])as.numeric(v[k])else NULL);me[[key]]<-all(v[active]>=-feasibilityTol)};rr[[i]]<-list(grade=vec(g),N=he$N,estimated=he,exact=xe,membership=me,slack=sl)}
 maxAbs<-vapply(seq_len(K),function(k)max(abs(eh[,,k]-ex[,,k]),na.rm=TRUE),0);excess<-maxAbs-ep;cnt<-setNames(lapply(names(th),function(key)sum(vapply(rr,function(r)r$membership[[key]],TRUE))),names(th));empty<-lapply(cnt,function(n)n==0)
 counter<-function(a,b){ix<-which(vapply(rr,function(r)r$membership[[a]]&&!r$membership[[b]],TRUE));if(length(ix))rr[[ix[1]]]$grade else NULL};ce1<-counter('inner','exact');ce2<-counter('exact','outer')
 list(family=list(size=nrow(G)),tau=tau,w=vec(w),q=q,epsilon=vec(ep),innerThreshold=lapply(seq_len(K),function(k)if(active[k])inner[k]else NULL),outerThreshold=lapply(seq_len(K),function(k)if(active[k])outer[k]else NULL),feasibilityTol=feasibilityTol,coefficientCheck=list(maxAbs=vec(maxAbs),excess=vec(excess),strictEnvelopeHolds=all(excess<=0),withinCoefficientTolerance=all(excess<=coefficientTol),coefficientTol=coefficientTol),actualBracketInclusions=list(innerSubsetExact=is.null(ce1),exactSubsetOuter=is.null(ce2),innerSubsetNominal=is.null(counter('inner','nominal')),nominalSubsetOuter=is.null(counter('nominal','outer')),counterexampleInnerExact=ce1,counterexampleExactOuter=ce2),counts=cnt,empty=empty,rows=rr)
}
protectadd<-function(id,Eh,Ex,opts){add(paste0('protection-',id),'protectionEnvelopes',list(Ehat=Eh,Eexact=Ex,options=opts),protection(Eh,Ex,opts$q,unclass(opts$epsilon),opts$tau,opts$w,opts$family %or% list(kind='all'),opts$feasibilityTol %or% 0,opts$coefficientTol %or% 1e-12))}
for(t in c(0,.2))for(exact in c(FALSE,TRUE)){f<-if(exact)list(kind='exactly',G=2L)else list(kind='all');protectadd(paste0('book-t',t,if(exact)'-exact2'else '-all'),pairE(t),pairE(t+.1),list(q=list(t+.05),epsilon=.1,tau=.25,family=f))}
protectadd('event-fails-inner-counterexample',pairE(.2),pairE(.2+.1),list(q=list(.25),epsilon=.05,tau=.25))
protectadd('event-fails-outer-counterexample',pairE(.1),pairE(0),list(q=list(0),epsilon=.05,tau=.25))
protectadd('binary-advisory-tol0',pairE(.2),pairE(.2+.1),list(q=list(.25),epsilon=.1,tau=.25,coefficientTol=0))
protectadd('explicit-count-feasibility-tolerance',pairE(.2),pairE(.2+.1),list(q=list(.2),epsilon=0,tau=.25,feasibilityTol=.1000000000000001))
protectadd('zero-weight-still-protected',pairE(c(0,.2)),pairE(c(0,.3)),list(q=list(NULL,.25),epsilon=vec(c(0,.1)),tau=.25,w=vec(c(1,0)),family=list(kind='exactly',G=2L)))
protectadd('inactive-large-error-still-coefficient-checked',pairE(c(.2,.1)),pairE(c(.3,.7)),list(q=list(.4,NULL),epsilon=vec(c(.2,.1)),tau=.25,w=vec(c(1,0))))
protectadd('weak-equality-both-directions',pairE(c(.6,.9),c(.9,.6)),pairE(c(.6,.9),c(.9,.6)),list(q=list(.75,.75),epsilon=0,tau=.5,w=vec(c(.5,.5))))
protectadd('empty-base-family',E19,E19,list(q=list(.2,NULL),epsilon=vec(c(.1,.3)),tau=.2,w=vec(c(.6,.4)),family=list(kind='exactly',G=5L)))
protectadd('small-order-block-family',E19,E19,list(q=list(.25,.5),epsilon=.1,tau=.2,w=vec(c(.6,.4)),family=list(kind='order',order=vec(0:3),blocks=vec(c(1L,2L,1L)),G=2L)))
protectadd('approximate-nonreciprocal-accepted',pairE(.2,.2),pairE(.3,.7),list(q=list(.25),epsilon=.5,tau=.25))
protectadd('signed-outer-above-one',pairE(.2),pairE(.3),list(q=list(.95),epsilon=.1,tau=.25))
protectadd('all-inactive-still-coefficient-checks',pairE(c(.2,.1)),pairE(c(.3,.7)),list(q=list(NULL,NULL),epsilon=vec(c(.2,.1)),tau=.25,w=vec(c(1,0))))

# 8. Approved public finite-law compositions, complete JOINT count laws.
composite <- function(states,p,a,w,tau,multiplier=NULL,f=list(kind='all')){K<-ncol(states[[1]]);multiplier<-multiplier %or% rep(1,K);cs<-lapply(states,function(s)matrix(drop(s%*%(a*multiplier)),ncol=1));Ec<-finite(states,p);Es<-finite(cs,p,criteria='composite');ec<-uncube(Ec);es<-uncube(Es);oc<-optimum(ec,tau,w,f);os<-optimum(es,tau,1,f)
 list(compositeStates=lapply(cs,unname),criterionE=Ec,compositeE=Es,criterionOptimum=optbrief(oc),compositeOptimum=optbrief(os),reports=lapply(list(oc$grade,os$grade),function(g)list(grade=g,criterion=evaluate(g,ec,tau,w),composite=evaluate(g,es,tau,1),wrong=wrong(g,states,p,w))))}
finiteadd<-function(id,states,p,a,w,tau,multiplier=NULL,f=list(kind='all')){opts<-list(states=lapply(states,unname),probs=vec(p),a=vec(a),w=vec(w),tau=tau,family=f);if(!is.null(multiplier))opts$multiplier<-vec(multiplier);add(paste0('finite-composite-',id),'finiteCompositePart4',opts,composite(states,p,a,w,tau,multiplier,f))}
finiteadd('known-opposition',list(rbind(c(1,-2),c(0,0))),1,c(.5,.5),c(.75,.25),.3)
finiteadd('known-opposition-multiplier',list(rbind(c(1,-2),c(0,0))),1,c(.5,.5),c(.75,.25),.3,c(1,.1))
finiteadd('known-composite-tie',list(rbind(c(1,-1),c(0,0))),1,c(.5,.5),c(.75,.25),.3)
finiteadd('chapter19-full',chapter19,p19,c(.75,.25),c(.6,.4),.2)
finiteadd('chapter19-positive-scale',lapply(chapter19,function(s)sweep(s,2,c(2,.5),'*')),p19,c(.75,.25),c(.6,.4),.2)
finiteadd('chapter19-affine-compensated',lapply(chapter19,function(s)sweep(sweep(s,2,c(2,.5),'*'),2,c(10,-3),'+')),p19,c(.75/2,.25/.5),c(.6,.4),.2)
finiteadd('chapter19-exp-pushforward',lapply(chapter19,exp),p19,c(.75,.25),c(.6,.4),.2)
coupling<-list(rbind(c(2,2),c(0,0)),rbind(c(-1,-1),c(0,0)),rbind(c(2,-1),c(0,0)),rbind(c(-1,2),c(0,0)))
for(lambda in c(0,.3,1))finiteadd(paste0('coupling-',lambda),coupling,c(lambda/2,lambda/2,(1-lambda)/2,(1-lambda)/2),c(.5,.5),c(.5,.5),.2)
finiteadd('zero-weight-joint-distinction',list(rbind(c(1,-1),c(0,0))),1,c(.5,.5),c(1,0),.3)
# A complete 75-report chapter19 joint count table pins more than the two
# selected reports and includes N0, strict and reversed reports.
G19<-allreports(4)
add('joint-count-chapter19-all75','jointWrongCountsPart4',list(states=lapply(chapter19,unname),probs=vec(p19),w=vec(c(.6,.4)),family=list(kind='all')),list(rows=lapply(seq_len(nrow(G19)),function(i)list(grade=vec(G19[i,]),distribution=wrong(G19[i,],chapter19,p19,c(.6,.4))))))

# 9. Genuine toy32 tensor; deterministic whole-unit row reindexing FIRST,
# retained prefix SECOND. Counts are exact integers with null diagonals.
toyPath<-file.path(postrank_src,'inst','examples','synthetic-iid.json');toy<-jsonlite::fromJSON(toyPath,simplifyVector=FALSE);toyStates<-lapply(toy$joint_draws$tensor$values,function(s)do.call(rbind,lapply(s,unlist)));toyIds<-unlist(toy$entity_ids);toyCriteria<-unlist(toy$criterion_ids);stopifnot(length(toyStates)==32L,identical(dim(toyStates[[1]]),c(3L,2L)))
releasedToy<-jsonlite::fromJSON(file.path(released_dir,'toy-joint-draws.json'),simplifyVector=FALSE)
stopifnot(identical(unlist(releasedToy$arrays$joint$values),unlist(toy$joint_draws$tensor$values)),identical(unlist(releasedToy$arrays$joint$ids),toyIds),identical(unlist(releasedToy$arrays$joint$criteria),toyCriteria),identical(releasedToy$facts$source_sha256,sha256_file(toyPath)))
toyresult<-function(prefix,shift=0L,unit=1L,allUnits=FALSE){S<-length(toyStates);z<-toyStates;for(s in seq_len(S)){src<-(s-1L+shift)%%S+1L;if(allUnits)z[[s]]<-toyStates[[src]]else z[[s]][unit+1L,]<-toyStates[[src]][unit+1L,]};z<-head(z,prefix);E<-finite(z,NULL,toyIds,toyCriteria);E$pi<-E$t<-NULL;counts<-lapply(E$e,function(x)unname(round(x*prefix)));list(E=E,counts=counts)}
for(prefix in c(1L,2L,4L,8L,16L,31L,32L))for(mode in c('original','unit-shift','shared-shift')){shift<-if(mode=='original')0L else 1L;add(paste0('toy32-',mode,'-prefix',prefix),'toyDrawsPart4',list(prefix=prefix,shift=shift,unit=1L,allUnits=mode=='shared-shift'),toyresult(prefix,shift,1L,mode=='shared-shift'))}
for(shift in c(0L,7L,32L))add(paste0('toy32-unit-shift',shift,'-full'),'toyDrawsPart4',list(prefix=32L,shift=shift,unit=1L,allUnits=FALSE),toyresult(32L,shift))
checks$toySourceSha256<-sha256_file(toyPath);checks$toySourceNotice<-toy$context$model_summary;checks$toyOriginalCounts<-toyresult(32)$counts;checks$toyShiftCounts<-toyresult(32,1)$counts
stopifnot(identical(toyresult(32)$counts,toyresult(32,1,allUnits=TRUE)$counts));close(toyresult(32)$counts[[1]][cbind(c(1,1,2),c(2,3,3))],c(8,0,2));close(toyresult(32,1)$counts[[1]][cbind(c(1,1,2),c(2,3,3))],c(7,0,4))

# 10. Explicit Cartesian lattice, stable positional ids. Each row is the
# exact same-law optimum for its declared loss and family; cap changes family.
lattice<-function(E,taus,caps,ww){e<-uncube(E);out<-list();prev<-NULL
 for(ti in seq_along(taus))for(ci in seq_along(caps))for(wi in seq_along(ww)){f<-list(kind='atMost',G=caps[ci]);o<-optimum(e,taus[ti],ww[[wi]],f);g<-o$grade;ev<-evaluate(g,e,taus[ti],ww[[wi]]);out[[length(out)+1L]]<-list(id=paste0('tau',ti,'-cap',ci,'-w',wi),tau=taus[ti],cap=caps[ci],w=vec(ww[[wi]]),grade=g,grades=o$grades,tieCount=o$tieCount,evaluation=ev,change=if(is.null(prev))NULL else change(prev,g,e,ww[[wi]]));prev<-g}
 list(rows=out)}
for(spec in list(list(id='six-small-full',E=E6,taus=c(.2,.35),caps=c(1L,2L,3L,6L),ww=list(c(.5,.5),c(0,1),c(1,0))),list(id='chapter19-full',E=E19,taus=c(.2,.25,.4),caps=c(1L,2L,4L),ww=list(c(.6,.4),c(1,0))))){ans<-lattice(spec$E,spec$taus,spec$caps,spec$ww);add(paste0('settings-',spec$id),'settingsLatticePart4',list(E=spec$E,taus=vec(spec$taus),caps=vec(spec$caps),weights=lapply(spec$ww,vec)),ans)
 for(ti in seq_along(spec$taus))for(wi in seq_along(spec$ww)){risk<-vapply(seq_along(spec$caps),function(ci)ans$rows[[(ti-1)*length(spec$caps)*length(spec$ww)+(ci-1)*length(spec$ww)+wi]]$evaluation$risk,0);stopifnot(all(diff(risk)<=1e-12))}}

# Validation pins specify only throw/no-throw, never implementation messages.
throwadd<-function(id,fn,args)add(paste0('validation-',id),paste0(fn,'Throws'),args,list(threw=TRUE))
for(s in list(list(id='normal-mismatched',means=list(c(1,2),c(3,4)),sds=list(c(1,1)),options=list(a=vec(c(.5,.5)))),list(id='normal-negative-sd',means=list(c(1),c(2)),sds=list(c(-1),c(1)),options=list(a=vec(1))),list(id='normal-zero-multiplier',means=list(c(1),c(2)),sds=list(c(1),c(1)),options=list(a=vec(1),multiplier=vec(0))),list(id='normal-short-a',means=list(c(1,2),c(3,4)),sds=list(c(1,1),c(1,1)),options=list(a=vec(1))),list(id='normal-duplicate-ids',means=list(c(1),c(2)),sds=list(c(1),c(1)),options=list(a=vec(1),ids=vec(c('A','A')))))){id<-s$id;s$id<-NULL;throwadd(id,'normalComposite',s)}
for(s in list(list(id='constraint-self',stating=list(vec(c(0,0)))),list(id='constraint-index',stating=list(vec(c(0,4)))),list(id='constraint-fractional',stating=list(vec(c(.5,1))))))throwadd(s$id,'pairConstrainedOptimum',list(E=E19,options=list(tau=.2,w=vec(c(.6,.4)),stating=s$stating)))
throwadd('protection-negative-epsilon','protectionEnvelopes',list(Ehat=pairE(.2),Eexact=pairE(.3),options=list(q=list(.25),epsilon=-.1,tau=.25)))
throwadd('protection-negative-feasibility-tol','protectionEnvelopes',list(Ehat=pairE(.2),Eexact=pairE(.3),options=list(q=list(.25),epsilon=.1,tau=.25,feasibilityTol=-1)))
throwadd('protection-q-outside','protectionEnvelopes',list(Ehat=pairE(.2),Eexact=pairE(.3),options=list(q=list(1.1),epsilon=.1,tau=.25)))
badE<-pairE(.2);badE$ids<-vec(c('B','A'));throwadd('protection-id-order-mismatch','protectionEnvelopes',list(Ehat=pairE(.2),Eexact=badE,options=list(q=list(.25),epsilon=.1,tau=.25)))
throwadd('protection-negative-weight','protectionEnvelopes',list(Ehat=pairE(c(.2,.3)),Eexact=pairE(c(.3,.4)),options=list(q=list(.25,.25),epsilon=.1,tau=.25,w=vec(c(-.1,1.1)))))
throwadd('compare-length','compareReports',list(g0=vec(c(1,2)),g1=vec(c(1,2,3)),E=pairE(.2),options=list(tau=.25)))

# Cross-check substantive distinctions with exact rationals and independent
# combinatorial identities, in addition to the DP-vs-enumeration checks above.
byid<-setNames(lapply(rows,`[[`,'expect'),vapply(rows,`[[`,'','id'))
ch<-byid[['finite-composite-chapter19-full']]
stopifnot(identical(as.integer(ch$criterionOptimum$grade),c(1L,2L,2L,3L)),identical(as.integer(ch$compositeOptimum$grade),c(1L,1L,2L,3L)))
close(ch$criterionOptimum$risk,17/120);close(ch$compositeOptimum$risk,1/30);close(ch$reports[[1]]$composite$risk,3/40);close(ch$reports[[2]]$criterion$risk,1/6)
close(ch$reports[[1]]$wrong$expected,.65);close(ch$reports[[1]]$wrong$pAllCriteriaRight,.75)
for(id in c('chapter19-positive-scale','chapter19-affine-compensated','chapter19-exp-pushforward'))stopifnot(identical(ch$criterionE,byid[[paste0('finite-composite-',id)]]$criterionE),identical(ch$criterionOptimum$grades,byid[[paste0('finite-composite-',id)]]$criterionOptimum$grades))
stopifnot(identical(ch$compositeE,byid[['finite-composite-chapter19-affine-compensated']]$compositeE))
zw<-byid[['finite-composite-zero-weight-joint-distinction']]$reports[[1]]$wrong;stopifnot(zw$pNone==1,zw$pAllCriteriaRight==0)
stopifnot(byid[['constrained-half-full-minimizers-truncated']]$tieCount>length(byid[['constrained-half-full-minimizers-truncated']]$grades),byid[['constrained-order-half-fullties']]$familySize==2^4-1,byid[['constrained-order-half-exact3']]$familySize==choose(4,2)-choose(2,2))
stopifnot(byid[['constrained-krw97-cap4-stated']]$familySize==sum(choose(95,0:2)),byid[['constrained-krw97-uncapped-stated']]$familySize==sprintf('%.0f',2^95))
R6cap<-t(apply(familyreports(6,list(kind='atMost',G=3L)),1,function(g)evaluate(g,e6,.2,c(.5,.5))$Rk));checks$sixDeterministicMinimax<-min(apply(R6cap,1,max));checks$sixEnvelopeMaximum<-byid[['weight-maximum-six-cap3']]$envelopeMaximum
stopifnot(checks$sixEnvelopeMaximum$risk<checks$sixDeterministicMinimax-1e-6)
pb<-byid[['protection-book-t0.2-all']];stopifnot(!pb$coefficientCheck$strictEnvelopeHolds,pb$coefficientCheck$withinCoefficientTolerance,pb$coefficientCheck$maxAbs[1]>.1,pb$actualBracketInclusions$innerSubsetExact,pb$actualBracketInclusions$exactSubsetOuter)
stopifnot(!byid[['protection-event-fails-inner-counterexample']]$actualBracketInclusions$innerSubsetExact,!byid[['protection-event-fails-outer-counterexample']]$actualBracketInclusions$exactSubsetOuter)

assert_no_postrank();stopifnot(!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3p4',rows,'r-export/35_v3_part4.R',uses_postrank=FALSE)
cat('oracle-v3p4:',length(rows),'independent rows; functions:',paste(sort(unique(vapply(rows,function(r)r$args$fn,''))),collapse=', '),'\n')
print(checks)
