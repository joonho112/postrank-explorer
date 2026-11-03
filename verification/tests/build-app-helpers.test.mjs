import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validate,APP_HELPERS} from '../../scripts/build.mjs';
const catalog={parts:[],apps:[]};
test('only explicitly registered shared app factories bypass app-file catalog matching',()=>{
 assert.deepEqual(validate(catalog,{appFiles:['krw-common.js','cde-common.js']}),[]);
 assert.deepEqual(validate(catalog,{appFiles:['unregistered.js']}),['js/apps/unregistered.js has no catalog entry']);
 assert.deepEqual(validate(catalog,{appFiles:['arbitrary-common.js']}),['js/apps/arbitrary-common.js has no catalog entry']);
});
test('helper allowlist does not exempt catalog entry validation',()=>{
 const bad={parts:[],apps:[{id:'5.3',name:'krw-common',part:'5',status:'invalid'}]};
 const errors=validate(bad,{appFiles:['krw-common.js']});
 assert.ok(errors.some(x=>x.includes('missing title')));
 assert.ok(errors.some(x=>x.includes('status must be')));
});

test('bundle discovery uses the same exact allowlist and never builds helpers as standalone apps',()=>{
 const file=new URL('../../engine/scripts/build-bundles.mjs',import.meta.url);
 const source=readFileSync(file,'utf8');
 const literal=/const APP_HELPERS = Object\.freeze\((\[[^;]+\])\)/.exec(source)[1];
 assert.deepEqual(JSON.parse(literal),APP_HELPERS);
 for(const helper of ['krw-common','cde-common']){
  const child=spawnSync(process.execPath,[fileURLToPath(file),'--only',helper],{encoding:'utf8'});
  assert.equal(child.status,1);assert.match(child.stderr,/does not exist/);
  assert.doesNotMatch(child.stderr,/No matching export/);
 }
 // A real app is discovered and passed to esbuild, even if its existing bundle needs regeneration.
 const ordinary=spawnSync(process.execPath,[fileURLToPath(file),'--only','krw-lambda','--check'],{encoding:'utf8'});
 assert.ok([0,1].includes(ordinary.status));
 assert.doesNotMatch(ordinary.stderr,/does not exist|No matching export/);
});
