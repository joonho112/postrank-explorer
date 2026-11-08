# Author: JoonHo Lee (jlee296@ua.edu).
# Independent display pins for4.2/4.9/4.11. This producer reads original public
# inputs and previously independently authored PURE base-R functions only.
# It never imports app JS, TS implementation/tests, or a postrank namespace.
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');assert_no_postrank()
write_json_stable<-function(x,path){dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE);writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE);invisible(path)}
pureNames<-c('vec','%or%','Mof','lexsort','gl','earr','uncube','weights','evaluate','change','allreports','familyCache','familyreports','optimum','optbrief','finite','compare')
found<-character();for(expr in parse('r-export/35_v3_part4.R'))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pureNames){eval(expr);found<-c(found,as.character(expr[[2]]))};stopifnot(setequal(found,pureNames))
close<-function(a,b,tol=1e-12)stopifnot(length(a)==length(b),max(c(0,abs(a-b)),na.rm=TRUE)<tol)
rows<-list();add<-function(id,fn,args,expect)rows[[length(rows)+1L]]<<-list(id=id,args=c(list(fn=fn),args),expect=expect)
inputs<-new.env(parent=emptyenv());utils::data(list=c('pr_tutorial','pr_example_gaussian'),package='postrank',lib.loc=postrank_lib,envir=inputs);assert_no_postrank()
laws<-list(six=list(E=earr(unname(inputs$pr_tutorial$two$e),inputs$pr_tutorial$two$entity_ids,inputs$pr_tutorial$two$criterion_ids)),thirty=list(E=earr(unname(inputs$pr_example_gaussian$e),inputs$pr_example_gaussian$entity_ids,inputs$pr_example_gaussian$criterion_ids)))
finiteLaw<-function(states,p){e<-finite(states,p,LETTERS[seq_len(nrow(states[[1]]))],c('criterion 1','criterion 2'));e$pi<-e$t<-NULL;list(states=states,p=p,E=e)}
laws$book<-finiteLaw(list(rbind(c(1,1),c(0,0)),rbind(c(1,-1),c(0,0))),c(.5,.5))
laws$opposition<-finiteLaw(list(rbind(c(1,0),c(0,1))),1)
laws$uncertain<-finiteLaw(list(rbind(c(1,1),c(0,0)),rbind(c(-1,-1),c(0,0))),c(.5,.5))
laws$ties<-finiteLaw(list(rbind(c(1,-1),c(0,0)),rbind(c(-1,1),c(0,0)),rbind(c(0,0),c(0,0))),c(.4,.1,.5))
laws$ch19<-finiteLaw(list(rbind(c(4,4),c(3,2),c(2,3),c(1,1)),rbind(c(3,1),c(4,2),c(2,3),c(1,4))),c(.75,.25))
# Whole original toy tensor; count weak events directly with integer sums,
# before division. Preserve whole selected-unit K-vectors while permuting.
toyPath<-file.path(postrank_src,'inst','examples','synthetic-iid.json');toy<-jsonlite::fromJSON(toyPath,simplifyVector=FALSE);original<-lapply(toy$joint_draws$tensor$values,function(s)do.call(rbind,lapply(s,unlist)));toyIds<-unlist(toy$entity_ids);toyCriteria<-unlist(toy$criterion_ids);stopifnot(length(original)==32L,identical(dim(original[[1]]),c(3L,2L)))
released<-jsonlite::fromJSON(file.path(released_dir,'toy-joint-draws.json'),simplifyVector=FALSE)$arrays$joint;stopifnot(identical(toyIds,unlist(released$ids)),identical(toyCriteria,unlist(released$criteria)));close(unlist(original),unlist(lapply(released$values,function(s)do.call(rbind,lapply(s,unlist)))),0.000000000000000001)
drawE<-function(states){n<-3L;K<-2L;S<-length(states);counts<-array(NA_real_,c(n,n,K));for(k in seq_len(K))for(i in seq_len(n))for(j in seq_len(n))if(i!=j)counts[i,j,k]<-sum(vapply(states,function(st)st[i,k]<=st[j,k],TRUE));ec<-earr(counts,toyIds,toyCriteria)$e;E<-earr(counts/S,toyIds,toyCriteria);E$S<-S;E$counts<-ec;list(E=E,counts=ec)}
scoreOrder<-function(v){o<-order(-v,toyIds,method='radix');list(order=vec(o-1L),blocks=vec(rle(v[o])$lengths))}
for(spec in list(list(id='original',shift=0L,allUnits=FALSE,draw=0L),list(id='unit-shift1',shift=1L,allUnits=FALSE,draw=15L),list(id='shared-shift1',shift=1L,allUnits=TRUE,draw=31L),list(id='unit-shift7',shift=7L,allUnits=FALSE,draw=0L))){z<-original;for(s in seq_len(32L)){src<-(s-1L+spec$shift)%%32L+1L;if(spec$allUnits)z[[s]]<-original[[src]]else z[[s]][2,]<-original[[src]][2,]};prefixes<-lapply(seq_len(32L),function(s)c(list(prefix=s),drawE(head(z,s))));selected<-z[[spec$draw+1L]];out<-list(original=list(ids=vec(toyIds),criteria=vec(toyCriteria),values=lapply(original,unname)),input=list(draws=lapply(z,unname),ids=vec(toyIds),criteria=vec(toyCriteria)),prefixes=prefixes,selected=c(list(draw=spec$draw,state=unname(selected),orders=lapply(seq_len(2L),function(k)scoreOrder(selected[,k]))),drawE(list(selected))))
 add(paste0('toy-display-',spec$id),'toyDisplayPart4',list(prefix=32L,shift=spec$shift,unit=1L,allUnits=spec$allUnits,draw=spec$draw),out)}
stopifnot(identical(rows[[1]]$expect$prefixes[[32]]$counts,rows[[3]]$expect$prefixes[[32]]$counts));close(rows[[1]]$expect$prefixes[[32]]$counts[[1]][1,2],8);close(rows[[2]]$expect$prefixes[[32]]$counts[[1]][1,2],7)
# Expected-criterion minimax: independently evaluate EVERY report; allcriteria
# remain included at zero objective weight. Return every retained tied profile.
guarded<-function(data,w,tau,f){E<-laws[[data]]$E;e<-uncube(E);G<-familyreports(dim(e)[1],f);evals<-lapply(seq_len(nrow(G)),function(i)evaluate(G[i,],e,tau,w));worst<-vapply(evals,function(ev)max(ev$Rk),0);ix<-which(worst<=min(worst)+1e-12);grades<-gl(head(G[ix,,drop=FALSE],100L));g<-grades[[1]];ev<-evaluate(g,e,tau,w);weighted<-optimum(e,tau,w,f);wev<-evaluate(weighted$grade,e,tau,w);all<-any(apply(G,1,function(g)length(unique(g))==1L))
 list(weighted=c(weighted[c('grade','grades','tieCount','risk')],list(Rk=wev$Rk,max=max(wev$Rk))),minimax=list(grade=g,grades=grades,tieCount=length(ix),value=max(ev$Rk),Rk=ev$Rk,weightedRisk=ev$risk),included=vec(0:1),familySize=nrow(G),containsAllWithheld=all,tieTol=1e-12,weightedProfiles=lapply(weighted$grades,function(g)list(grade=g,evaluation=evaluate(g,e,tau,w))),guardedProfiles=lapply(grades,function(g)list(grade=g,evaluation=evaluate(g,e,tau,w))),comparisons=lapply(grades,function(g)compare(as.numeric(weighted$grade),as.numeric(g),e,tau,w)))}
for(w in c(.9,.7,.3,0))add(paste0('guarded-six-w',w),'guardedDisplayPart4',list(data='six',w=vec(c(w,1-w)),tau=.2,family=list(kind='atMost',G=3L)),guarded('six',c(w,1-w),.2,list(kind='atMost',G=3L)))
for(w in c(.3,.5,.7,1))add(paste0('guarded-book-w',w),'guardedDisplayPart4',list(data='book',w=vec(c(w,1-w)),tau=.25,family=list(kind='all')),guarded('book',c(w,1-w),.25,list(kind='all')))
add('guarded-opposition-exact2','guardedDisplayPart4',list(data='opposition',w=vec(c(.5,.5)),tau=.5,family=list(kind='exactly',G=2L)),guarded('opposition',c(.5,.5),.5,list(kind='exactly',G=2L)))
# Posterior pair costs compare reverse weak errors. With latent equalities,
# preferred directions need not coincide with a threshold at one half.
decision<-function(ij,ji,tau){cost<-c(iAboveJ=ij,jAboveI=ji,withhold=tau);list(costs=as.list(cost),best=vec(names(cost)[cost<=min(cost)+1e-12]),directionalMinimum=min(ij,ji))}
conflicts<-function(e){out<-list();for(i in seq_len(dim(e)[1]-1))for(j in (i+1):dim(e)[1]){d<-e[j,i,]-e[i,j,];a<-which(d>1e-12);b<-which(d< -1e-12);if(length(a)&&length(b))out[[length(out)+1L]]<-list(i=i-1L,j=j-1L,iAbove=vec(a-1L),jAbove=vec(b-1L))};list(count=length(out),pairs=out)}
paircost<-function(data,pair,w,tau){L<-laws[[data]];e<-uncube(L$E);i<-pair[1]+1L;j<-pair[2]+1L;ij<-sum(w*e[i,j,]);ji<-sum(w*e[j,i,]);list(E=L$E,criteria=lapply(seq_len(dim(e)[3]),function(k)list(k=k-1L,eIJ=e[i,j,k],eJI=e[j,i,k],decision=decision(e[i,j,k],e[j,i,k],tau))),weighted=list(eIJ=ij,eJI=ji,decision=decision(ij,ji,tau)),conflicts=conflicts(e),states=if(is.null(L$states))NULL else lapply(seq_along(L$states),function(s){st<-L$states[[s]];list(prob=L$p[s],decision=decision(sum(w*(st[i,]<=st[j,])),sum(w*(st[j,]<=st[i,])),tau))}))}
pairadd<-function(id,data,pair,w,tau)add(paste0('pair-cost-',id),'pairCostDisplayPart4',list(data=data,pair=vec(pair),w=vec(w),tau=tau),paircost(data,pair,w,tau))
for(pair in list(c(0L,2L),c(1L,2L),c(1L,3L)))pairadd(paste0('six-',paste(pair,collapse='-')),'six',pair,c(.5,.5),.2)
pairadd('thirty-0-1','thirty',c(0L,1L),rep(1/3,3),.2);pairadd('ch19-B-C','ch19',c(1L,2L),c(.6,.4),.2)
for(w in c(.5,0,1))pairadd(paste0('opposition-w',w),'opposition',c(0L,1L),c(w,1-w),.2)
pairadd('opposition-boundary','opposition',c(0L,1L),c(.5,.5),.5);pairadd('uncertain','uncertain',c(0L,1L),c(.5,.5),.2)
for(pair in list(c(0L,1L),c(1L,0L)))pairadd(paste0('ties-',paste(pair,collapse='-')),'ties',pair,c(.5,.5),.2)
assert_no_postrank();stopifnot(length(rows)==25L,!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3p4-displays',rows,'r-export/38_v3_part4_displays.R',uses_postrank=FALSE)
cat('oracle-v3p4-displays:',length(rows),'rows; all32prefixes, fullguardedprofiles/prices and finite/normal paircosts; no package solver/namespace loaded.\n')
