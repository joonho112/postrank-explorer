# Author: JoonHo Lee (jlee296@ua.edu)
# Independent enumeration check for app 2.18's four rerun settings.
# Run from the repository root: Rscript r-export/26_v3_part2_selection_check.R
# This is a source-only integration check, not a new golden-value group.
# The engine supplies the estimated pair-error arrays and observed app outputs; base R
# independently enumerates the common report family, chooses its lexicographic minimizer,
# computes exact normal probabilities with pnorm, evaluates both risks, and aggregates
# the signed gaps and bounds. Gaussian generation/draw shares themselves are covered by
# the existing independent oracle-v3 and oracle-simulate rows. Thus this check does not
# claim an independent reimplementation of the entire simulation pipeline.
# No raw draws or estimated-array fixtures are retained. Existing oracle-v3 selected-run
# UI pins remain the durable expected-value sources for the app's focused DOM regression.
if (!file.exists("js/apps/chosen-and-judged.js")) stop("run from the repository root")
input_path <- tempfile("prx-selection-check-", fileext = ".json")
node_source <- r"---(import fs from "node:fs";
import {drawErrors,gaussianDraws} from "./js/pr-core.js";
import {selectionRun,summarizeRuns} from "./js/apps/chosen-and-judged.js";
import SIX from "./data/released/six-sites.json" with {type:"json"};
const U=SIX.tables.units,out=[];
for(const s of [{S:100,seed:1,criteria:"A",tau:.2,cap:"none"},{S:4000,seed:1,criteria:"A",tau:.2,cap:"none"},{S:100,seed:1,criteria:"A",tau:.2,cap:3},{S:40,seed:11,criteria:"AB",tau:.25,cap:3}]){
 const cols=s.criteria==="AB"?["A","B"]:["A"],means=U.id.map((_,i)=>cols.map(c=>U["mean_"+c][i])),sds=U.id.map((_,i)=>cols.map(c=>U["sd_"+c][i]));
 const rows=Array.from({length:100},(_,i)=>{const st={...s,seed:s.seed+i};return {ehat:drawErrors(gaussianDraws(means,sds,s.S,st.seed),{ids:U.id,criteria:cols}).e,expect:selectionRun(st)};});
 out.push({settings:s,means,sds,rows,summary:summarizeRuns(rows.map(r=>r.expect))});
}
fs.writeFileSync(process.argv[1],JSON.stringify(out));)---"
status <- system2("node", c("--input-type=module", "-e", shQuote(node_source), shQuote(input_path)))
if (status != 0L) stop("could not recreate the deterministic estimated arrays")
source('r-export/_oracle.R');assert_no_postrank()
a<-jsonlite::fromJSON(input_path,simplifyVector=FALSE)
unlink(input_path)
num<-function(v)vapply(v,function(x)if(is.null(x))NA_real_ else as.numeric(x),0)
mat<-function(x)do.call(rbind,lapply(x,num))
G<-oracle_reports(6);G<-G[do.call(order,unname(as.data.frame(G))),]
risk<-function(g,e,tau){E<-N<-numeric(nrow(g));for(i in 1:5)for(j in (i+1):6){lt<-g[,i]<g[,j];gt<-g[,i]>g[,j];N<-N+lt+gt;E<-E+e[i,j]*lt+e[j,i]*gt};list(N=N,r=(E+tau*(15-N))/15)}
checks<-0
for(set in a){
 s<-set$settings;gs<-if(s$cap=='none')G else G[apply(G,1,max)<=s$cap,,drop=FALSE]
 means<-mat(set$means);sd<-mat(set$sds);K<-ncol(means);w<-rep(1/K,K)
 exact<-lapply(seq_len(K),function(k){e<-outer(seq_len(6),seq_len(6),Vectorize(function(i,j)pnorm((means[j,k]-means[i,k])/sqrt(sd[i,k]^2+sd[j,k]^2))));diag(e)<-NA;e})
 weighted<-function(E)Reduce('+',Map(function(e,w){e[is.na(e)]<-0;e*w},E,w))
 ex<-risk(gs,weighted(exact),s$tau);best<-which(ex$r<=min(ex$r)+1e-12)[1]
 outs<-lapply(set$rows,function(row){eh<-lapply(row$ehat,mat);er<-risk(gs,weighted(eh),s$tau);i<-which(er$r<=min(er$r)+1e-12)[1];delta<-sum(w*vapply(seq_len(K),function(k)max(abs(eh[[k]]-exact[[k]]),na.rm=TRUE),0));v<-c(N=ex$N[i],inSample=er$r[i],exact=ex$r[i],gap=er$r[i]-ex$r[i],deltaW=delta,bound=ex$N[i]*delta/15,best=ex$r[best],regret=ex$r[i]-ex$r[best]);stopifnot(identical(as.integer(gs[i,]),as.integer(unlist(row$expect$grade))));for(n in names(v)){stopifnot(abs(v[n]-as.numeric(row$expect[[n]]))<1e-12);checks<<-checks+1};v})
 B<-do.call(rbind,outs);su<-c(n=nrow(B),better=sum(B[,'gap']<0),worse=sum(B[,'gap']>0),same=sum(B[,'gap']==0),gap=mean(B[,'gap']),absolute=mean(abs(B[,'gap'])),bound=mean(B[,'bound']),regret=mean(B[,'regret']));for(n in names(su)){stopifnot(abs(su[n]-as.numeric(set$summary[[n]]))<1e-12);checks<-checks+1}
 cat(s$criteria,s$S,s$cap,'positive',su['worse'],'mean gap',su['gap'],'mean absolute',su['absolute'],'PASS\n')
}
cat(checks,'independent scalar checks plus 400 grade vectors PASS\n')
