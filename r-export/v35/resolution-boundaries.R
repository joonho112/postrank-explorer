# Author: JoonHo Lee (jlee296@ua.edu)
# Independent public-API oracle for finite resolution and boundary cases.
# Run from the Explorer root after the shared v3.5 adapter passes its smoke gate.
source('r-export/v35/_oracle.R')
request_paths <- sort(list.files('r-export/v35/requests',
  pattern='^(resolution-|boundary-).*\\.json$',full.names=TRUE))
if (!length(request_paths)) stop('No resolution/boundary requests found')
out_dir <- 'verification/golden/v35'
dir.create(out_dir,recursive=TRUE,showWarnings=FALSE)
records <- list()
expected_risks <- c('resolution-k1-a0'='1/4','resolution-k0-a0'='0',
  'resolution-k1-a3'='1/5','resolution-k1-a5'='11/80',
  'resolution-k1-a6'='7/80','resolution-k2-a6'='17/80')
for (path in request_paths) {
  request <- v35_read_fixture(path)
  result <- v35_oracle_fixture(request,
    generator='r-export/v35/resolution-boundaries.R',fixed_cards='all')
  id <- result$fixtureId
  if (id %in% names(expected_risks))
    stopifnot(identical(result$expected$fit$riskExact,unname(expected_risks[id])))
  if (id == 'boundary-positive-coarsening') {
    cards <- setNames(lapply(result$expected$fixedCards, `[[`, 'evaluation'),
      vapply(result$expected$fixedCards, `[[`, '', 'cardId'))
    fine <- cards[['p:1,2,3']]; coarse <- cards[['p:1,1,2']]
    stopifnot(fine$jointProbabilityExact=='0', coarse$jointProbabilityExact=='1',
      fine$domains[[1]]$expectedFalseProportionExact=='1/3',
      coarse$domains[[1]]$expectedFalseProportionExact=='1/2',
      isTRUE(fine$meanFeasible), !isTRUE(coarse$meanFeasible))
  }
  target <- file.path(out_dir,paste0(id,'.json'))
  v35_write_fixture(result,target)
  records[[length(records)+1L]] <- list(fixtureId=id,path=target,
    riskExact=result$expected$fit$riskExact,
    optimizerCount=length(result$expected$fit$optimizerIds))
}
# Scalar cutoff test does not pretend to be a 40-unit browser-law input.
q <- gmp::as.bigq('1/20')
cutoff <- (500L*1L)%/%20L+1L
stopifnot(cutoff==26L,!as.logical(gmp::as.bigq('25/500')>q),
  as.logical(gmp::as.bigq('26/500')>q))
jsonlite::write_json(list(schemaVersion='postrank-explorer-mdomain-scalars-v1',
  provenance='Independent base-R integer arithmetic and gmp rational comparison; no fitted-object claim.',
  cases=list(list(threshold='1/20',N=500L,firstExceedanceCount=cutoff,
    atThreshold=list(falseCount=25L,ratioExact='1/20',exceeds=FALSE),
    aboveThreshold=list(falseCount=26L,ratioExact='13/250',exceeds=TRUE)))),
  file.path(out_dir,'scalar-boundaries.json'),pretty=TRUE,auto_unbox=TRUE)
receipt_dir <- 'verification/report/v35-oracle'
dir.create(receipt_dir,recursive=TRUE,showWarnings=FALSE)
jsonlite::write_json(list(status='PASS',step='Step 3.4',fixtures=records,
  scalarCutoffChecked=TRUE,oldGoldensModified=FALSE),
  file.path(receipt_dir,'resolution-report.json'),pretty=TRUE,auto_unbox=TRUE)
cat('PASS:',length(records),'complete public-API finite-law fixtures and scalar boundary tests\n')
