# Author: JoonHo Lee (jlee296@ua.edu)
# Capture independent reference rejection for the invalid-payload ledger.
source('r-export/v35/_oracle.R')
path <- 'verification/golden/v35/negative-cases.json'
x <- jsonlite::read_json(path,simplifyVector=FALSE)
for (i in seq_along(x$cases)) {
  item <- x$cases[[i]]
  if (isTRUE(item$referenceRejectionRequired)) {
    err <- tryCatch({v35_oracle_fixture(item$payload,
      generator='r-export/v35/negative-ledger.R');NULL},error=function(e)e)
    if (is.null(err)) stop('Expected reference rejection: ',item$caseId)
    item$reference <- list(outcome='rejected',class=I(class(err)),
      message=conditionMessage(err),
      scope='Public R constructor or explicit adapter identity/resource validation; not a claim that browser/R error codes are identical.')
  } else item$reference <- list(outcome='not_required',
    scope='Browser representation/subset validation; no R rejection claimed.')
  x$cases[[i]] <- item
}
jsonlite::write_json(x,path,pretty=TRUE,auto_unbox=TRUE,null='null',na='null',digits=NA)
receipt_dir <- 'verification/report/v35-oracle'
dir.create(receipt_dir,recursive=TRUE,showWarnings=FALSE)
jsonlite::write_json(list(status='PASS',cases=length(x$cases),
  referenceRejections=sum(vapply(x$cases,function(z)isTRUE(z$referenceRejectionRequired),TRUE)),
  broaderRSubsetDistinctions=TRUE),file.path(receipt_dir,'negative-report.json'),pretty=TRUE,auto_unbox=TRUE)
cat('PASS: negative ledger with explicit rejection/subset scopes\n')
