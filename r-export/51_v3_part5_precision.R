# Author: JoonHo Lee (jlee296@ua.edu).
# Independent raw-source pins for accepted gap/V8. No new app/TS/JS values or expected fixtures are read.
source('r-export/_paths.R');source('r-export/_helpers.R');source('r-export/_oracle.R');assert_no_postrank()
write_json_stable<-function(x,path){dir.create(dirname(path),recursive=TRUE,showWarnings=FALSE);writeLines(jsonlite::toJSON(x,auto_unbox=TRUE,digits=17,na='null',null='null',pretty=1),path,useBytes=TRUE);invisible(path)}
case<-jsonlite::fromJSON(file.path(released_dir,'case-krw.json'),simplifyVector=FALSE)
grid<-jsonlite::fromJSON(file.path(released_dir,'krw-lambda-grid.json'),simplifyVector=FALSE)
u<-case$tables$units;f<-grid$tables$firms;ids<-unname(unlist(case$arrays$error$ids));criteria<-unname(unlist(case$arrays$error$criteria));columns<-c('race_se','gender_se')
stopifnot(length(ids)==97L,!anyDuplicated(ids),identical(ids,unname(unlist(u$id))),identical(ids,unname(unlist(f$id))),identical(criteria,c('race_signed','gender_signed')))
SE<-lapply(columns,function(column){v<-unname(as.numeric(unlist(u[[column]])));stopifnot(length(v)==97L,all(is.finite(v)),all(v>0),identical(v,unname(as.numeric(unlist(f[[column]])))));I(v)})
names<-unname(unlist(u$firm_name));stopifnot(length(names)==97L,all(nzchar(names)))
rows<-list(list(id='krw-original-sampling-se',args=list(fn='caseKrwPrecisionInputs',data='case-krw'),expect=list(n=97L,ids=I(ids),names=I(names),criteria=I(criteria),columns=I(columns),SE=SE)))
assert_no_postrank();write_golden('oracle-v3p5-precision',rows,'r-export/51_v3_part5_precision.R',uses_postrank=FALSE)
path<-file.path(golden_dir,'oracle-v3p5-precision.json');written<-jsonlite::fromJSON(path,simplifyVector=FALSE);manifest<-jsonlite::fromJSON(file.path(manifest_dir,'oracle-v3p5-precision.json'))
stopifnot(identical(unname(as.numeric(unlist(written$rows[[1]]$expect$SE))),unname(as.numeric(unlist(SE)))),identical(unname(unlist(written$rows[[1]]$expect$ids)),ids),manifest$rows==1L,identical(manifest$sha256,sha256_file(path)))
assert_no_postrank();cat('oracle-v3p5-precision:1 raw-source row,97matchedIDs,two complete sampling-SE vectors,17digit/exactjoin/checksum PASS.\n')
