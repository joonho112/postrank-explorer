// Author: JoonHo Lee (jlee296@ua.edu).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkMdomainData,loadMdomainDataFiles,MDOMAIN_DATA_CONFIG} from '../check_mdomain_data.mjs';
const base=MDOMAIN_DATA_CONFIG.directory,primary=`${base}/main-alpha-1_20.json`,wide=`${base}/sensitivity-t-wide.json`,manifest=`${base}/manifest.json`;
const fixture=()=>new Map([...loadMdomainDataFiles()].map(([p,b])=>[p,Buffer.from(b)]));
function mutate(files,p,fn){const x=JSON.parse(String(files.get(p)));fn(x);files.set(p,Buffer.from(JSON.stringify(x)));}
const errors=files=>checkMdomainData({files}).errors.join('\n');
test('licensed frozen handoff passes with two cards and all 1560 original pairs',()=>{const r=checkMdomainData();assert.deepEqual(r.errors,[]);assert.equal(r.cases,2);assert.equal(r.rows.reduce((s,r)=>s+r.pairs,0),1560);});
test('missing files and unexpected private files are rejected',()=>{const f=fixture();f.delete(primary);assert.match(errors(f),/required file missing/);const g=fixture();g.set(`${base}/private-draws.rds`,Buffer.from('private'));assert.match(errors(g),/unexpected file/);});
test('payload and rewritten manifest hashes cannot be silently replaced together',()=>{const f=fixture();mutate(f,primary,x=>x.results.risk_exact='0');mutate(f,manifest,x=>x.cases['main-alpha-1_20'].sha256=createHash('sha256').update(f.get(primary)).digest('hex'));assert.match(errors(f),/manifest SHA-256/);assert.match(errors(f),/stored empirical summary differs/);});
test('raw states nested under a metadata field are caught beyond the hash mismatch',()=>{const f=fixture();mutate(f,primary,x=>x.targets.S={raw_states:[[1,2]]});assert.match(errors(f),/forbidden raw\/private data field/);assert.match(errors(f),/target descriptions must be text/);});
test('new unknown fields fail closed schema validation',()=>{const f=fixture();mutate(f,wide,x=>x.results.expected_false_count=4);assert.match(errors(f),/unexpected field/);});
test('license author and exact source provenance are substantive gates',()=>{for(const fn of [x=>x.attribution.author='Other',x=>x.attribution.content_license='Unknown',x=>x.source_identity.sha256='0'.repeat(64)]){const f=fixture();mutate(f,primary,fn);assert.match(errors(f),/author attribution differs|content terms missing|source provenance differs/);}});
test('assurance and chain independence flags cannot be promoted',()=>{const f=fixture();mutate(f,wide,x=>{x.assurance.intended_posterior_feasibility_certified=true;x.state_roles.chain_split_establishes_independence=true;});assert.match(errors(f),/assurance flag must remain false/);assert.match(errors(f),/chain split cannot establish independence/);});
test('changed tuples, identity ties and occupancy/pair classes fail independently of byte hashes',()=>{const f=fixture();mutate(f,wide,x=>x.grade_tuples[4][2]=1);assert.match(errors(f),/structural identity pair split/);assert.match(errors(f),/tuple-derived occupancy\/pair classes differ/);const g=fixture();mutate(g,primary,x=>x.grade_tuples.reverse());assert.match(errors(g),/original-order integer grade tuples/);});
test('saved thresholds and missing stored error fractions cannot be invented',()=>{const f=fixture();mutate(f,primary,x=>{x.design.t='1/10';x.results.selection_any_error_hits=0;});assert.match(errors(f),/saved exact policy differs/);assert.match(errors(f),/stored empirical summary differs/);});
test('CLI fails on an absent frozen display directory',()=>{const dir=mkdtempSync(join(tmpdir(),'v35-data-'));try{const p=spawnSync(process.execPath,[fileURLToPath(new URL('../check_mdomain_data.mjs',import.meta.url)),'--root',dir],{encoding:'utf8'});assert.equal(p.status,1);assert.match(p.stderr,/required file missing/);}finally{rmSync(dir,{recursive:true,force:true});}});
