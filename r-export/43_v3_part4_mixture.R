# Author: JoonHo Lee (jlee296@ua.edu)
# Independent base-R criterion-mixture displays. No new4.8 app JS/TS/tests or
# JS-computed expectations read. Frozen R35 pure math + declared input laws.
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');assert_no_postrank()
write_json_stable<-function(x,path){dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE);writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE);invisible(path)}
pureNames<-c('vec','%or%','Mof','lexsort','gl','earr','uncube','weights','evaluate','allreports','familyCache','familyreports','optimum','optbrief','finite')
found<-character();for(expr in parse('r-export/35_v3_part4.R'))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pureNames){eval(expr);found<-c(found,as.character(expr[[2]]))};stopifnot(setequal(found,pureNames))
six<-jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE);E6<-earr(uncube(six$arrays$two),unlist(six$arrays$two$ids),unlist(six$arrays$two$criteria))
finiteE<-function(st){x<-finite(list(st),1,c('A','B'),paste('criterion',seq_len(ncol(st))));x$pi<-x$t<-NULL;x}
Es<-list(six=E6,opposition=finiteE(rbind(c(1,0),c(0,1))),majority=finiteE(rbind(c(1,1,0),c(0,0,1))))
mixture<-function(data,w,tau,family){E<-Es[[data]];e<-uncube(E);o<-optimum(e,tau,w,family);grades<-if(data=='six')o$grades else gl(familyreports(2,family))
 list(optimum=optbrief(o),reports=lapply(grades,function(g){ev<-evaluate(as.numeric(g),e,tau,w);parts<-w*as.numeric(ev$Rk);risk<-sum(parts);stopifnot(abs(risk-ev$risk)<1e-14);list(grade=g,evaluation=ev,mixture=list(risk=risk,Rk=ev$Rk,w=vec(w),weightedRisk=ev$risk,difference=risk-ev$risk),contributions=vec(parts))}))}
rows<-list();add<-function(id,data,w,tau,family){rows[[length(rows)+1L]]<<-list(id=id,args=list(fn='criterionMixtureDisplayPart4',data=data,w=vec(w),tau=tau,family=family),expect=mixture(data,w,tau,family))}
add('mixture-six-equal-tau20-cap3','six',c(.5,.5),.2,list(kind='atMost',G=3L))
add('mixture-six-equal-tau35-all','six',c(.5,.5),.35,list(kind='all'))
add('mixture-six-B-only-tau20-cap3','six',c(0,1),.2,list(kind='atMost',G=3L))
add('mixture-six-A-only-tau20-cap3','six',c(1,0),.2,list(kind='atMost',G=3L))
for(tau in c(.3,.5))add(paste0('mixture-opposition-equal-tau',tau),'opposition',c(.5,.5),tau,list(kind='all'))
for(w in list(c(1,0),c(0,1)))add(paste0('mixture-opposition-w',paste(w,collapse='-')),'opposition',w,.3,list(kind='all'))
for(tau in c(.3,1/3,.4))add(paste0('mixture-majority-tau',if(tau==1/3)'one-third'else tau),'majority',rep(1/3,3),tau,list(kind='all'))
stopifnot(rows[[2]]$expect$reports[[1]]$evaluation$N==14L,identical(as.numeric(rows[[2]]$expect$optimum$grade),c(1,2,2,3,4,5)),rows[[3]]$expect$optimum$tieCount==2L,rows[[6]]$expect$optimum$tieCount==3L,rows[[10]]$expect$optimum$tieCount==2L)
assert_no_postrank();stopifnot(length(rows)==11L)
write_golden('oracle-v3p4-mixture',rows,'r-export/43_v3_part4_mixture.R',uses_postrank=FALSE)
cat('oracle-v3p4-mixture:',length(rows),'rows; scalarcontributions/fullmixture/fullretainedties and exactone-thirdboundary PASS.\n')
