// Author: JoonHo Lee (jlee296@ua.edu).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkV35Coverage,canonicalCoverageQuery} from '../check_v35_coverage.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const entry={id:'P.1',name:'tiny',part:'P',status:'built',presets:[{id:'start',query:'x=1'},{id:'other',query:'x=2&label=A%2CB'}],try:[{preset:'start',shows:['1']}]};
 const data={app:'tiny',catalog:'P.1',cases:[{id:'other',preset:'other',expect:[{select:'.n',source:'oracle',ref:{group:'independent',row:'value',field:'n'}}]}]};
 return new Map(Object.entries({'catalog.json':JSON.stringify({apps:[entry]}),'catalog/site.json':JSON.stringify({parts:[{key:'P',slug:'profiles'}]}),'catalog/entries/P.1-tiny.json':JSON.stringify(entry),'js/apps/tiny.js':'export function mountWidget() {}','pages/profiles/tiny.qmd':'# Tiny','docs/pages/profiles/tiny.html':'<h1>Tiny</h1>','verification/readouts/tiny.json':JSON.stringify(data)}).map(([k,v])=>[k,Buffer.from(v)]));
}
function mutate(files,path,fn){const x=JSON.parse(String(files.get(path)));fn(x);files.set(path,Buffer.from(JSON.stringify(x)));}
const errors=files=>checkV35Coverage({files}).errors.join('\n');
test('coverage derives the built inventory and covers a preset through readout or numeric try',()=>{const r=checkV35Coverage({files:fixture()});assert.deepEqual(r.errors,[]);assert.equal(r.builtApps,1);assert.equal(r.presets,2);});
test('decoded complete raw query matches without key-order dependence',()=>{const f=fixture();mutate(f,'verification/readouts/tiny.json',x=>{delete x.cases[0].preset;x.cases[0].query='?label=A,B&x=2';});assert.deepEqual(checkV35Coverage({files:f}).errors,[]);assert.equal(canonicalCoverageQuery('?x=2&x=3'),null);});
test('missing and empty built artifacts fail instead of skipping',()=>{for(const p of ['js/apps/tiny.js','pages/profiles/tiny.qmd','docs/pages/profiles/tiny.html','verification/readouts/tiny.json']){const f=fixture();f.delete(p);assert.match(errors(f),/required.*missing/);}const f=fixture();f.set('js/apps/tiny.js',Buffer.from(' '));assert.match(errors(f),/nonempty/);});
test('unknown try/readout presets and an uncovered preset fail',()=>{const f=fixture();mutate(f,'verification/readouts/tiny.json',x=>{x.cases[0].preset='typo';});assert.match(errors(f),/unknown preset typo/);assert.match(errors(f),/preset other has no/);});
test('empty or unsourced cases do not count as coverage',()=>{for(const expect of [[],[{}],[{select:'.n',source:'app',ref:'self'}]]){const f=fixture();mutate(f,'verification/readouts/tiny.json',x=>x.cases[0].expect=expect);assert.match(errors(f),/preset other has no/);}});
test('readout app/catalog identity and source/merged catalog drift are rejected',()=>{const f=fixture();mutate(f,'verification/readouts/tiny.json',x=>x.app='wrong');assert.match(errors(f),/identity/);const g=fixture();mutate(g,'catalog.json',x=>x.apps[0].presets[0].query='x=8');assert.match(errors(g),/presets differs/);});
test('valid legacy raw try queries are checked structurally without invented preset exceptions',()=>{const f=fixture();for(const p of ['catalog.json','catalog/entries/P.1-tiny.json'])mutate(f,p,x=>(x.apps?.[0]??x).try.push({query:'x=3&draw=1',shows:['3']}));assert.deepEqual(checkV35Coverage({files:f}).errors,[]);});
test('empty built catalog cannot produce a vacuous pass',()=>{const f=fixture();mutate(f,'catalog.json',x=>x.apps=[]);assert.match(errors(f),/nonempty apps array required|no built apps|absent from merged/);});
test('CLI returns nonzero for a missing readout file',()=>{const dir=mkdtempSync(join(tmpdir(),'v35-coverage-'));try{for(const[p,b]of fixture()){const path=join(dir,p);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,b);}rmSync(join(dir,'verification/readouts/tiny.json'));const p=spawnSync(process.execPath,[fileURLToPath(new URL('../check_v35_coverage.mjs',import.meta.url)),'--root',dir],{encoding:'utf8'});assert.equal(p.status,1);assert.match(p.stderr,/required file missing/);}finally{rmSync(dir,{recursive:true,force:true});}});

test('an exact initial query followed by a scientific update does not cover the original preset',()=>{const f=fixture();mutate(f,'verification/readouts/tiny.json',x=>{delete x.cases[0].preset;x.cases[0].query='x=2&label=A%2CB';x.cases[0].update=[{x:3}];});assert.match(errors(f),/preset other has no/);});

test('named presets with later overrides do not cover the original preset output',()=>{for(const patch of [{spec:{x:3}},{update:[{x:3}]}]){const f=fixture();mutate(f,'verification/readouts/tiny.json',x=>Object.assign(x.cases[0],patch));assert.match(errors(f),/preset other has no/);}});
