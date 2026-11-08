# Author: JoonHo Lee (jlee296@ua.edu).
# Independent base-R fixed-report joint/correct-fraction compositions.
# No new4.8/4.13 JS or TS implementation is read or executed. Root integrates
# the4.10 UI: its one extra point is independently recomputed by the separately
# authored pure-R35 enumeration, not copied from the UI. This is method
# independence, not a blinded source review. No package namespace or solver.
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');assert_no_postrank()
write_json_stable<-function(x,path){dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE);writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE);invisible(path)}
pureNames<-c('vec','%or%','Mof','lexsort','gl','earr','uncube','weights','evaluate','allreports','familyCache','familyreports','optimum','optbrief','finite','wrong')
found<-character();for(expr in parse('r-export/35_v3_part4.R'))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pureNames){eval(expr);found<-c(found,as.character(expr[[2]]))};stopifnot(setequal(found,pureNames))
rows<-list();add<-function(id,fn,args,expect)rows[[length(rows)+1L]]<<-list(id=id,args=c(list(fn=fn),args),expect=expect)
plain<-function(x){x$pi<-x$t<-NULL;x}
stateWrong<-function(g,st){D<-rep(0,ncol(st));N<-0L;for(i in seq_len(length(g)-1))for(j in (i+1):length(g))if(g[i]!=g[j]){N<-N+1L;a<-if(g[i]<g[j])i else j;b<-if(a==i)j else i;D<-D+as.numeric(st[a,]<=st[b,])};list(N=N,D=vec(D))}
correct<-function(ev)if(ev$N>0)1-ev$Ew/ev$N else NULL
coupling<-function(lambda,w,tau=.2){states<-list(rbind(c(2,2),c(0,0)),rbind(c(-1,-1),c(0,0)),rbind(c(2,-1),c(0,0)),rbind(c(-1,2),c(0,0)));p<-c(lambda/2,lambda/2,(1-lambda)/2,(1-lambda)/2);Ec<-plain(finite(states,p,c('A','B'),c('criterion 1','criterion 2')));comp<-lapply(states,function(st)matrix(st%*%c(.5,.5),ncol=1));Es<-plain(finite(comp,p,c('A','B'),'composite'));ec<-uncube(Ec);es<-uncube(Es);G<-familyreports(2,list(kind='all'))
 list(criterionE=Ec,compositeE=Es,criterionOptimum=optbrief(optimum(ec,tau,w)),compositeOptimum=optbrief(optimum(es,tau,1)),reports=lapply(seq_len(nrow(G)),function(i){g<-G[i,];ev<-evaluate(g,ec,tau,w);list(grade=vec(g),criterion=ev,composite=evaluate(g,es,tau,1),wrong=wrong(g,states,p,w),states=lapply(seq_along(states),function(s)c(list(prob=p[s]),stateWrong(g,states[[s]]))),meanCorrectFraction=correct(ev))}))}
for(w in list(c(.5,.5),c(1,0)))for(lambda in if(w[1]==.5)c(0,.3,.5,1)else c(0,.5,1))add(paste0('coupling-all-lambda',lambda,'-w',paste(w,collapse='-')),'couplingAllPart4',list(lambda=lambda,w=vec(w),tau=.2),coupling(lambda,w))
states<-list(rbind(c(4,4),c(3,2),c(2,3),c(1,1)),rbind(c(3,1),c(4,2),c(2,3),c(1,4)));p<-c(.75,.25);g<-c(1L,2L,2L,3L);w<-c(.6,.4);Ec<-plain(finite(states,p,LETTERS[1:4],c('criterion 1','criterion 2')));ev<-evaluate(g,uncube(Ec),.2,w)
add('ch19-fixed1223-joint-accuracy','lawWrongDisplayPart4',list(data='ch19',grade=vec(g),w=vec(w),tau=.2),list(criterionE=Ec,evaluation=ev,wrong=wrong(g,states,p,w),states=lapply(seq_along(states),function(s)c(list(prob=p[s]),stateWrong(g,states[[s]]))),meanCorrectFraction=correct(ev)))
stopifnot(ev$N==5L,abs(correct(ev)-.87)<1e-15,identical(as.numeric(stateWrong(g,states[[1]])$D),c(0,0)),identical(as.numeric(stateWrong(g,states[[2]])$D),c(1,5)))
six<-jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE);E6<-plain(earr(uncube(six$arrays$two),unlist(six$arrays$two$ids),unlist(six$arrays$two$criteria)));e6<-uncube(E6);f<-list(kind='atMost',G=3L);o<-optimum(e6,.4,c(.5,.5),f)
add('settings-six-tau40-cap3-equal','settingsPointPart4',list(tau=.4,w=vec(c(.5,.5)),family=f),list(optimum=optbrief(o),profiles=lapply(o$grades,function(g)list(grade=g,evaluation=evaluate(g,e6,.4,c(.5,.5))))))
byid<-setNames(lapply(rows,`[[`,'expect'),vapply(rows,`[[`,'','id'));for(x in c('coupling-all-lambda0-w0.5-0.5','coupling-all-lambda1-w0.5-0.5'))stopifnot(byid[[x]]$reports[[2]]$criterion$EoverN[1]==.5)
stopifnot(byid[['coupling-all-lambda0-w1-0']]$reports[[2]]$wrong$pNone>.0,byid[['coupling-all-lambda0-w1-0']]$reports[[2]]$wrong$pAllCriteriaRight==0)
assert_no_postrank();stopifnot(length(rows)==9L)
write_golden('oracle-v3p4-joint-accuracy',rows,'r-export/41_v3_part4_joint_accuracy.R',uses_postrank=FALSE)
cat('oracle-v3p4-joint-accuracy:',length(rows),'rows; ALL3 fixed coupling reports, ch19statecounts/correctfraction, independenttau40point PASS.\n')
