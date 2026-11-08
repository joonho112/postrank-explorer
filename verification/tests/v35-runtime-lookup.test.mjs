// Author: JoonHo Lee (jlee296@ua.edu).
// Exercise the real R lookup branch with a simulated absent global package; no library is changed.
import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{spawnSync}from'node:child_process';
test('An absent global postrank lookup reports the installation/library remedy',t=>{
 const script=readFileSync(new URL('../run_v35.sh',import.meta.url),'utf8'),expression=/POSTRANK_LIB=\$\(Rscript -e '([^']+)'\)/.exec(script)?.[1];assert.ok(expression,'the tested expression must be the actual driver lookup');
 const result=spawnSync('Rscript',['-e','find.package <- function(...) character(); '+expression],{encoding:'utf8'});
 if(result.error?.code==='ENOENT'){t.skip('Rscript unavailable; full v3.5 gate independently requires R');return;}
 assert.notEqual(result.status,0);assert.match(result.stderr,/Install postrank 1\.2\.0 or set POSTRANK_LIB/);assert.doesNotMatch(result.stderr,/argument is of length zero/);
});
