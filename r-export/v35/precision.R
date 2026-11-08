# Author: JoonHo Lee (jlee296@ua.edu)
# Exact reference cases that distinguish decisions below a floating tolerance.
source('r-export/v35/_oracle.R')
for(path in sort(list.files('r-export/v35/requests',pattern='^precision-.*[.]json$',full.names=TRUE))) {
 f<-v35_read_fixture(path);x<-v35_oracle_fixture(f,generator='r-export/v35/precision.R',fixed_cards='all')
 v35_write_fixture(x,file.path('verification/golden/v35-precision',paste0(f$fixtureId,'.json')))
}
cat('PASS: three exact precision references\n')
