# Author: JoonHo Lee (jlee296@ua.edu).
# Independently evaluate every public coupling-control position using postrank 1.2.0.
source(file.path("r-export", "v35", "_oracle.R"))
out <- file.path("verification", "golden", "v35-pilot")
dir.create(out, recursive=TRUE, showWarnings=FALSE)
for (i in 0:10) {
 request <- v35_read_fixture(file.path("r-export", "v35", "requests", paste0("pilot-c",i,".json")))
 result <- v35_oracle_fixture(request, generator="r-export/v35/dependence-pilot.R", fixed_cards="all")
 v35_write_fixture(result,file.path(out,paste0("dependence-c",i,".json")))
}
