// Author: JoonHo Lee (jlee296@ua.edu).
// Shell orchestration tests use command stubs; these are not numerical verification runs.
import{test}from'node:test';import assert from'node:assert/strict';import{mkdtempSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
function run(fail=''){
 const dir=mkdtempSync(join(tmpdir(),'prx-v35-driver-')),trace=join(dir,'trace.txt');
 writeFileSync(join(dir,'node'),'#!/bin/sh\nprintf "%s\\n" "$*" >> "$PRX_DRIVER_TRACE"\nif [ "${1-}" = "$PRX_DRIVER_FAIL" ]; then exit 42; fi\nexit 0\n',{mode:0o755});
 writeFileSync(join(dir,'Rscript'),'#!/bin/sh\nexit 0\n',{mode:0o755});
 try{const result=spawnSync('bash',['verification/run_all.sh','--no-render'],{cwd:root,env:{...process.env,PATH:dir+':'+process.env.PATH,PRX_DRIVER_TRACE:trace,PRX_DRIVER_FAIL:fail},encoding:'utf8'});return{...result,trace:readFileSync(trace,'utf8')};}finally{rmSync(dir,{recursive:true,force:true});}
}
for(const gate of ['verification/check_v35_coverage.mjs','verification/check_mdomain_data.mjs'])test(`The integrated shell propagates ${gate} failure and still records later gates (mock commands)`,()=>{const r=run(gate);assert.equal(r.status,1);assert.match(r.stdout,/run_all: FAIL/);assert.ok(r.trace.includes(gate));assert.ok(r.trace.includes('verification/check_solver.mjs'),'later stages must execute after a failed early gate');});
test('The integrated shell accepts only an all-success orchestration (mock commands)',()=>{const r=run();assert.equal(r.status,0);assert.match(r.stdout,/run_all: PASS/);assert.ok(r.trace.includes('verification/check_v35_coverage.mjs'));assert.ok(r.trace.includes('verification/check_mdomain_data.mjs'));});
