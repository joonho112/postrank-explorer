#!/usr/bin/env node
// Author: JoonHo Lee (jlee296@ua.edu).
// Structural coverage of every currently built app. Numeric/browser checks remain separate gates.
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const V35_COVERAGE_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
/** Exact decoded URL parameter maps, independent of key order; no default/value sanitizer is inferred. */
export function canonicalCoverageQuery(query){
 if(typeof query!=='string')return null;const pairs=[...new URLSearchParams(query.replace(/^\?/,''))].filter(([k])=>k!=='theme');
 if(new Set(pairs.map(([k])=>k)).size!==pairs.length)return null;
 return JSON.stringify(pairs.sort(([a],[b])=>a.localeCompare(b)));
}
export function loadV35CoverageFiles(root=V35_COVERAGE_ROOT){
 const files=new Map(),add=p=>{if(existsSync(join(root,p)))files.set(p,readFileSync(join(root,p)));};
 add('catalog.json');add('catalog/site.json');
 const dir=join(root,'catalog/entries');if(existsSync(dir))for(const f of readdirSync(dir))if(f.endsWith('.json'))add(`catalog/entries/${f}`);
 let catalog={},site={};try{catalog=JSON.parse(String(files.get('catalog.json')));site=JSON.parse(String(files.get('catalog/site.json')));}catch{return files;}
 for(const a of catalog.apps??[]){const slug=site.parts?.find(p=>p.key===a.part)?.slug;
  for(const p of [`js/apps/${a.name}.js`,`pages/${slug}/${a.name}.qmd`,`docs/pages/${slug}/${a.name}.html`,`verification/readouts/${a.name}.json`])add(p);
 }return files;
}
/** Every preset needs independent readout expectations or a quoted-number try entry; no app exceptions. */
export function checkV35Coverage({root=V35_COVERAGE_ROOT,files=loadV35CoverageFiles(root)}={}){
 const errors=[],rows=[],fail=(p,m)=>errors.push(`${p}: ${m}`);
 function json(p){if(!files.has(p)){fail(p,'required file missing');return null;}try{return JSON.parse(String(files.get(p)));}catch{fail(p,'invalid JSON');return null;}}
 function nonempty(p){if(!files.has(p)||!String(files.get(p)).trim()){fail(p,'required nonempty file missing');return false;}return true;}
 const catalog=json('catalog.json'),site=json('catalog/site.json');if(!catalog||!site)return{errors,rows,builtApps:0,presets:0};
 if(!Array.isArray(catalog.apps)||!catalog.apps.length){fail('catalog.json','nonempty apps array required');return{errors,rows,builtApps:0,presets:0};}
 const entries=[...files.keys()].filter(p=>/^catalog\/entries\/[^/]+\.json$/.test(p)).map(p=>({path:p,value:json(p)})).filter(r=>r.value);
 const sourceBuilt=entries.filter(r=>r.value.status==='built'),built=catalog.apps.filter(a=>a.status==='built');
 if(!built.length)fail('catalog.json','no built apps: coverage cannot silently pass');
 if(new Set(built.map(a=>a.name)).size!==built.length||new Set(built.map(a=>a.id)).size!==built.length)fail('catalog.json','built app names and IDs must be unique');
 for(const r of sourceBuilt)if(!built.some(a=>a.id===r.value.id&&a.name===r.value.name))fail(r.path,'built source entry absent from merged catalog');
 let presetCount=0;
 for(const app of built){
  const where=`${app.id} ${app.name}`,source=entries.filter(r=>r.value.id===app.id&&r.value.name===app.name);
  if(source.length!==1)fail(where,'exactly one matching source catalog entry required');
  else for(const key of ['part','status','presets','try'])if(JSON.stringify(source[0].value[key])!==JSON.stringify(app[key]))fail(source[0].path,`merged catalog ${key} differs from source entry`);
  const part=site.parts?.find(p=>p.key===app.part);if(!part){fail(where,'catalog part has no page slug');continue;}
  for(const p of [`js/apps/${app.name}.js`,`pages/${part.slug}/${app.name}.qmd`,`docs/pages/${part.slug}/${app.name}.html`])nonempty(p);
  const rpath=`verification/readouts/${app.name}.json`,readout=json(rpath),cases=readout?.cases;
  if(readout?.app!==app.name||readout?.catalog!==app.id)fail(rpath,'readout app/catalog identity does not match built entry');
  if(!Array.isArray(cases)||!cases.length||!cases.some(c=>Array.isArray(c.expect)&&c.expect.length))fail(rpath,'nonempty source-grounded readout cases required');
  const presets=Array.isArray(app.presets)?app.presets:[],ids=new Set(presets.map(p=>p.id));presetCount+=presets.length;
  if(!presets.length||ids.size!==presets.length)fail(where,'nonempty unique presets required');
  const covered=new Set(),coverage={};
  const grounded=c=>Array.isArray(c.expect)&&c.expect.length>0&&c.expect.every(e=>e&&typeof e.select==='string'&&e.select.trim()&&['oracle','golden','mdomain','registry','literal'].includes(e.source)&&Object.hasOwn(e,'ref'));
  for(const c of Array.isArray(cases)?cases:[]){
   if(c.preset!==undefined){if(!ids.has(c.preset))fail(rpath,`case ${c.id}: unknown preset ${c.preset}`);else if(grounded(c)&&!c.spec&&!c.update?.length){covered.add(c.preset);coverage[c.preset]='readout preset';}}
   else if(typeof c.query==='string'&&grounded(c)&&!c.spec&&!c.update?.length){const q=canonicalCoverageQuery(c.query);for(const p of presets)if(q!==null&&q===canonicalCoverageQuery(p.query)){covered.add(p.id);coverage[p.id]='exact readout query';}}
  }
  const tries=app.try;if(!Array.isArray(tries)||!tries.length)fail(where,'nonempty quoted-number try entries required');
  for(const [i,t]of(Array.isArray(tries)?tries:[]).entries()){
   const named=typeof t.preset==='string',queried=typeof t.query==='string'&&t.query.trim()!=='';
   const shows=Array.isArray(t.shows)&&t.shows.length&&t.shows.every(s=>typeof s==='string'&&s.trim());
   if(named===queried||!shows){fail(where,`try[${i}] needs exactly one preset/query and nonempty quoted shows`);continue;}
   if(named){if(!ids.has(t.preset))fail(where,`try[${i}] unknown preset ${t.preset}`);else{covered.add(t.preset);coverage[t.preset]='quoted-number try';}}
   else {const q=canonicalCoverageQuery(t.query);if(q===null||new URLSearchParams(t.query.replace(/^\?/,'' )).has('preset'))fail(where,`try[${i}] invalid/ambiguous raw query`);
    for(const p of presets)if(q!==null&&q===canonicalCoverageQuery(p.query)){covered.add(p.id);coverage[p.id]='exact quoted-number query';}}
  }
  for(const p of presets){if(typeof p.id!=='string'||!p.id||typeof p.query!=='string'||canonicalCoverageQuery(p.query)===null)fail(where,'preset needs a stable ID and unambiguous query');if(!covered.has(p.id))fail(where,`preset ${p.id} has no source-grounded readout or quoted-number try coverage`);}
  rows.push({id:app.id,name:app.name,cases:Array.isArray(cases)?cases.length:0,presets:presets.length,coveredPresets:covered.size,coverage});
 }
 return{errors,rows,builtApps:built.length,presets:presetCount};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);let root=V35_COVERAGE_ROOT;
 if(args.length){if(args.length!==2||args[0]!=='--root'){console.error('Usage: node verification/check_v35_coverage.mjs [--root directory]');process.exit(2);}root=resolve(args[1]);}
 const r=checkV35Coverage({root});for(const e of r.errors)console.error(`FAIL ${e}`);
 console.log(`check_v35_coverage: ${r.builtApps} built apps, ${r.presets} presets, ${r.errors.length} failure(s)`);process.exitCode=r.errors.length?1:0;
}
