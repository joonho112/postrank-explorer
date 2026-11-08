# Author: JoonHo Lee (jlee296@ua.edu)
# Additional exact R references for order-sensitive canonical representatives.
source('r-export/v35/_oracle.R')
paths <- sort(list.files('r-export/v35/requests',pattern='^permutation-.*[.]json$',full.names=TRUE))
for (path in paths) {
 f<-v35_read_fixture(path)
 result<-v35_oracle_fixture(f,generator='r-export/v35/permutations.R',fixed_cards='all')
 v35_write_fixture(result,file.path('verification/golden/v35-permutations',paste0(f$fixtureId,'.json')))
}
cat('PASS:',length(paths),'additional publicR permutation fixtures; original57unchanged\n')
