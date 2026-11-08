# Author: JoonHo Lee (jlee296@ua.edu).
# Independent estimand-display pins for the Part4 criterion/composite views.
# No new4.6/4.13 app JS, TypeScript implementation/tests, JS result, solver,
# browser or network is read/run. Original public inputs and frozen pure
# independent R35 mathematics supply every expected scientific value.
# Run from repository root: Rscript r-export/40_v3_part4_estimands.R
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');assert_no_postrank()
write_json_stable<-function(x,path){dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE);writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE);invisible(path)}
pureNames<-c('vec','%or%','Mof','lexsort','gl','earr','uncube','weights','evaluate','allreports','familyCache','familyreports','optimum','optbrief','finite','wrong','normalComposite','composite')
found<-character()
for(expr in parse('r-export/35_v3_part4.R'))if(is.call(expr)&&identical(expr[[1]],as.name('<-'))&&is.symbol(expr[[2]])&&as.character(expr[[2]])%in%pureNames){eval(expr);found<-c(found,as.character(expr[[2]]))}
stopifnot(setequal(found,pureNames));assert_no_postrank()
close<-function(a,b,tol=1e-12){stopifnot(length(a)==length(b),identical(as.logical(is.na(a)),as.logical(is.na(b))),all(abs(a[!is.na(a)]-b[!is.na(b)])<=tol*(1+abs(a[!is.na(a)]))));invisible(TRUE)}
rows<-list();add<-function(id,args,expect)rows[[length(rows)+1L]]<<-list(id=id,args=c(list(fn='estimandDisplayPart4'),args),expect=expect)

# Original public tutorial means and SDs. Criterion E deliberately follows
# the same released coefficient route as R35; the analytic composite uses
# the explicitly independent Normal law, not a guessed cross-criterion law.
inputs<-new.env(parent=emptyenv());utils::data(list='pr_tutorial',package='postrank',lib.loc=postrank_lib,envir=inputs);assert_no_postrank()
tu<-inputs$pr_tutorial;means<-unname(tu$law$means);sds<-unname(sqrt(t(apply(tu$law$covariance,3,diag))));ids<-tu$two$entity_ids;criteria<-tu$two$criterion_ids
release<-jsonlite::fromJSON(file.path(released_dir,'six-sites.json'),simplifyVector=FALSE);numericColumn<-function(x)vapply(x,as.numeric,0)
stopifnot(identical(ids,unlist(release$arrays$two$ids,use.names=FALSE)),identical(criteria,unlist(release$arrays$two$criteria,use.names=FALSE)),identical(means,unname(cbind(numericColumn(release$tables$units$mean_A),numericColumn(release$tables$units$mean_B)))),identical(sds,unname(cbind(numericColumn(release$tables$units$sd_A),numericColumn(release$tables$units$sd_B)))))
Esix<-earr(uncube(release$arrays$two),ids,criteria)

# Restated exact public book laws: states are whole unit-by-criterion tables.
# exp is applied to every coordinate of every state BEFORE the positive
# multiplier/composite construction. No transformation of posterior means
# substitutes for transforming the whole finite law.
laws<-list(ch19=list(states=list(rbind(c(4,4),c(3,2),c(2,3),c(1,1)),rbind(c(3,1),c(4,2),c(2,3),c(1,4))),probs=c(.75,.25)),known=list(states=list(rbind(c(1,-2),c(0,0))),probs=1))
finiteLabels<-function(E){E$ids<-vec(LETTERS[seq_len(length(E$ids))]);E$criteria<-vec(c('criterion 1','criterion 2'));E$pi<-E$t<-NULL;E}
# This union contains every retained member of BOTH complete argmin sets,
# without replacing either set by its representative or dropping duplicates
# by rounded risk. Deduplication is only by the exact canonical grade vector.
unionGrades<-function(a,b){G<-do.call(rbind,lapply(c(a,b),as.numeric));gl(lexsort(unique(G)))}

estimandDisplay<-function(data,transform,a,w,tau,family,multiplier){stopifnot(transform%in%c('identity','exp'),all(multiplier>0))
 if(data=='six'){
  stopifnot(transform=='identity');Ec<-Esix;baseline<-optbrief(optimum(uncube(Ec),tau,w,family));normal<-normalComposite(means,sds,a,multiplier,ids);Es<-normal$E;summary<-normal[c('mean','sd')]
 }else{
  law<-laws[[data]];originalE<-finiteLabels(finite(law$states,law$probs));baseline<-optbrief(optimum(uncube(originalE),tau,w,family))
  states<-if(transform=='exp')lapply(law$states,exp)else law$states
  # R35 computes each scalar composite inside each complete finite state,
  # then derives its exact weak directional probabilities from those states.
  composition<-composite(states,law$probs,a,w,tau,multiplier,family);Ec<-finiteLabels(composition$criterionE);Es<-composition$compositeE;Es$pi<-Es$t<-NULL;summary<-NULL
  # A common strictly increasing transform preserves every criterion error,
  # including equality semantics; this is checked for the WHOLE error cube.
  stopifnot(identical(Ec,originalE))
 }
 ec<-uncube(Ec);es<-uncube(Es);co<-optimum(ec,tau,w,family);so<-optimum(es,tau,1,family)
 stopifnot(!co$empty,!so$empty,identical(optbrief(co),baseline))
 reportsFor<-function(grades)lapply(grades,function(g){g<-as.numeric(g);criterion<-evaluate(g,ec,tau,w);composite<-evaluate(g,es,tau,1);stopifnot(criterion$N==composite$N,criterion$M==composite$M);list(grade=vec(g),criterion=criterion,composite=composite)})
 reports<-reportsFor(unionGrades(co$grades,so$grades));allReports<-if(data=='six')NULL else reportsFor(gl(familyreports(nrow(ec),family)))
 list(criterionE=Ec,compositeE=Es,criterionOptimum=optbrief(co),compositeOptimum=optbrief(so),baselineCriterionOptimum=baseline,reports=reports,allReports=allReports,compositeSummary=summary)
}
specs<-list(
 list(id='estimands-six-balanced',data='six',transform='identity',a=c(.5,.5),w=c(.5,.5),tau=.2,family=list(kind='atMost',G=3L),multiplier=c(1,1)),
 list(id='estimands-six-scaled-B01',data='six',transform='identity',a=c(.5,.5),w=c(.5,.5),tau=.2,family=list(kind='atMost',G=3L),multiplier=c(1,.1)),
 list(id='estimands-ch19-identity',data='ch19',transform='identity',a=c(.75,.25),w=c(.6,.4),tau=.2,family=list(kind='all'),multiplier=c(1,1)),
 list(id='estimands-ch19-exp',data='ch19',transform='exp',a=c(.75,.25),w=c(.6,.4),tau=.2,family=list(kind='all'),multiplier=c(1,1)),
 list(id='estimands-known-a75',data='known',transform='identity',a=c(.75,.25),w=c(.75,.25),tau=.3,family=list(kind='all'),multiplier=c(1,1)))
for(s in specs){ans<-estimandDisplay(s$data,s$transform,s$a,s$w,s$tau,s$family,s$multiplier);args<-s[c('data','transform','tau','family')];args$a<-vec(s$a);args$w<-vec(s$w);args$multiplier<-vec(s$multiplier);add(s$id,args,ans)
 for(kind in c('criterion','composite')){o<-ans[[paste0(kind,'Optimum')]];stopifnot(o$tieCount==length(o$grades));for(g in o$grades){hit<-which(vapply(ans$reports,function(r)identical(as.integer(r$grade),as.integer(g)),TRUE));stopifnot(length(hit)==1L);close(ans$reports[[hit]][[kind]]$risk,o$risk)}}
 if(s$data=='six')stopifnot(is.null(ans$allReports),length(ans$compositeSummary$mean)==6L,length(ans$compositeSummary$sd)==6L)else stopifnot(length(ans$allReports)==if(s$data=='ch19')75L else 3L,is.null(ans$compositeSummary))
 cat(s$id,': criterion',paste(ans$criterionOptimum$grade,collapse='/'),'ties',ans$criterionOptimum$tieCount,'risk',ans$criterionOptimum$risk,'; composite',paste(ans$compositeOptimum$grade,collapse='/'),'ties',ans$compositeOptimum$tieCount,'risk',ans$compositeOptimum$risk,'; union',length(ans$reports),'; fullfinite',length(ans$allReports),'\n')}
# Every one of the75 criterion evaluations and its full argmin set is
# invariant under the whole-state exp map. Composite probabilities are free
# to change, because the composite estimand changes with that map.
stopifnot(identical(rows[[3]]$expect$criterionE,rows[[4]]$expect$criterionE),identical(rows[[3]]$expect$criterionOptimum,rows[[4]]$expect$criterionOptimum),identical(lapply(rows[[3]]$expect$allReports,`[[`,'criterion'),lapply(rows[[4]]$expect$allReports,`[[`,'criterion')))
stopifnot(!identical(rows[[3]]$expect$compositeE,rows[[4]]$expect$compositeE),identical(rows[[1]]$expect$criterionE,rows[[2]]$expect$criterionE),identical(rows[[1]]$expect$criterionOptimum,rows[[2]]$expect$criterionOptimum))
assert_no_postrank();stopifnot(length(rows)==5L,!anyDuplicated(vapply(rows,`[[`,'','id')))
write_golden('oracle-v3p4-estimands',rows,'r-export/40_v3_part4_estimands.R',uses_postrank=FALSE)
cat('oracle-v3p4-estimands:',length(rows),'rows; full retained union argmin cross-evaluations and all75 chapter19 reports; independent base-R self-checks PASS.\n')
