#!/usr/bin/env node
// Author: JoonHo Lee (jlee296@ua.edu).
// Audit only the licensed v3.5 frozen display handoff; the original data contract is unchanged.
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const MDOMAIN_DATA_CONFIG=Object.freeze({
 root:resolve(dirname(fileURLToPath(import.meta.url)),'..'),directory:'data/precomputed/v35',
 manifestSha256:'0683c465a26aa7f5ac60b28bee0ca21403a34c3d6462a8b9681e811149f31cf8',
 assetSha256:'dfb8969958f5ea8474a968f276bd9b4f2226890e7f135eda1f88cbaa468f8c07',
 sourcePackageCommit:'da02a785f753efb060e149f04650970b0ea1e05b',
 originalCommit:'ff223082b27c8af92f762c20f49092f06b19a913',
 originalSha256:'bd36f6c0bad7d8d5abb540899b8d8ddca536e2705410118ddfc76d6b6bb5c590',
 cases:Object.freeze(['main-alpha-1_20','sensitivity-t-wide'])
});
const sha=b=>createHash('sha256').update(b).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
/** Read every file recursively, including unexpected files: no unlisted private payload can be skipped. */
export function loadMdomainDataFiles(root=MDOMAIN_DATA_CONFIG.root){
 const files=new Map(),base=join(root,MDOMAIN_DATA_CONFIG.directory);
 function walk(dir,rel){if(!existsSync(dir))return;for(const entry of readdirSync(dir,{withFileTypes:true})){
  const p=join(dir,entry.name),r=`${rel}/${entry.name}`;
  if(entry.isDirectory())walk(p,r);else files.set(r,readFileSync(p));
 }}
 walk(base,MDOMAIN_DATA_CONFIG.directory);return files;
}
/** Pure byte-map audit supports substantive planted faults without editing public assets. */
export function checkMdomainData({root=MDOMAIN_DATA_CONFIG.root,files=loadMdomainDataFiles(root)}={}){
 const errors=[],rows=[],base=MDOMAIN_DATA_CONFIG.directory,manifestPath=`${base}/manifest.json`;
 const fail=(p,m)=>errors.push(`${p}: ${m}`),assert=(condition,p,m)=>{if(!condition)fail(p,m);};
 function keys(x,allowed,p){if(!record(x)){fail(p,'expected object');return false;}
  for(const k of Object.keys(x))if(!allowed.includes(k))fail(`${p}.${k}`,'unexpected field (not in frozen display schema)');
  for(const k of allowed)if(!Object.hasOwn(x,k))fail(`${p}.${k}`,'required field missing');return true;}
 function read(p){const b=files.get(p);if(!b){fail(p,'required file missing');return null;}try{return JSON.parse(String(b));}catch{fail(p,'invalid JSON');return null;}}
 const allowed=new Set([manifestPath,...MDOMAIN_DATA_CONFIG.cases.map(id=>`${base}/${id}.json`)]);
 for(const p of files.keys())if(!allowed.has(p))fail(p,'unexpected file in frozen display directory');
 const manifest=read(manifestPath);
 if(manifest){
  assert(sha(files.get(manifestPath))===MDOMAIN_DATA_CONFIG.manifestSha256,manifestPath,'manifest SHA-256 differs from reviewed frozen manifest');
  keys(manifest,['schema_version','source_package','source_version','bundled_asset','bundled_asset_sha256','cases','source_public_package_commit','generator','scope'],manifestPath);
  assert(manifest.schema_version==='postrank-explorer-frozen-display-v1',manifestPath,'wrong manifest schema');
  assert(manifest.source_package==='postrank'&&manifest.source_version==='1.2.0',manifestPath,'source must be public postrank 1.2.0');
  assert(manifest.bundled_asset==='extdata/mdomain/synthetic40-card.json'&&manifest.bundled_asset_sha256===MDOMAIN_DATA_CONFIG.assetSha256,manifestPath,'bundled public asset identity differs');
  assert(manifest.source_public_package_commit===MDOMAIN_DATA_CONFIG.sourcePackageCommit,manifestPath,'public package source commit differs');
  keys(manifest.cases,MDOMAIN_DATA_CONFIG.cases,`${manifestPath}.cases`);
 }
 function scanForbidden(value,p){if(Array.isArray(value))value.forEach((v,i)=>scanForbidden(v,`${p}[${i}]`));else if(record(value))for(const[k,v]of Object.entries(value)){if(/^(?:raw_states|states|draws|posterior_draws|student_records|school_records|private.*|geography|coordinates|latitude|longitude|catchments)$/i.test(k))fail(`${p}.${k}`,'forbidden raw/private data field');scanForbidden(v,`${p}.${k}`);}}
 const allGrades=[];
 for(const [index,id]of MDOMAIN_DATA_CONFIG.cases.entries()){
  const p=`${base}/${id}.json`,x=read(p);if(!x)continue;
  scanForbidden(x,p);
  const spec=manifest?.cases?.[id];
  if(spec){keys(spec,['path','sha256','pairsChecked','derived'],`${manifestPath}.cases.${id}`);
   assert(spec.path===p,p,'manifest case path differs');assert(sha(files.get(p))===spec.sha256,p,'payload SHA-256 differs from manifest');assert(spec.pairsChecked===780,p,'manifest must declare 780 checked original pairs');}
  keys(x,['schema_version','package_version','case_id','case_role','runtime_postrank_object','purpose','attribution','source_identity','targets','domain_ids','grade_tuple_fields','grade_tuples','design','state_roles','results','derived_display','assurance'],p);
  assert(x.schema_version==='postrank-integration-card-1.2.0-v1'&&x.package_version==='1.2.0',p,'wrong display schema/package version');
  assert(x.case_id===id&&x.case_role===(index===0?'primary':'sensitivity'),p,'case identity/role differs');
  assert(x.runtime_postrank_object===false,p,'display cannot be a runtime fitted object');
  assert(typeof x.purpose==='string'&&x.purpose.includes('Frozen output illustration only'),p,'display-only purpose missing');
  if(keys(x.attribution,['author','copyright','title','source_url','content_license','license_url','original_code_license','changes'],`${p}.attribution`)){
   const a=x.attribution;assert(Object.values(a).every(v=>typeof v==='string'),p,'attribution values must be text');assert(a.author==='JoonHo Lee'&&a.copyright==='Copyright 2026 JoonHo Lee',p,'author attribution differs');
   assert(a.content_license==='CC BY 4.0'&&a.license_url==='https://creativecommons.org/licenses/by/4.0/',p,'CC BY 4.0 content terms missing');
   assert(a.source_url==='https://github.com/joonho112/need-based-prek-funding-tutorial',p,'original tutorial source differs');
   assert(a.original_code_license?.startsWith('MIT;')&&a.changes?.includes('excluded posterior states'),p,'original code terms/change notice missing');}
  if(keys(x.source_identity,['repository_commit','sha256','original_dimensions','representation','original_iterations'],`${p}.source_identity`)){
   const s=x.source_identity;assert(s.repository_commit===MDOMAIN_DATA_CONFIG.originalCommit&&s.sha256===MDOMAIN_DATA_CONFIG.originalSha256,p,'original source provenance differs');
   keys(s.original_dimensions,['retained_iterations','chains','units','domains'],`${p}.source_identity.original_dimensions`);
   assert(equal(s.original_dimensions,{retained_iterations:4000,chains:4,units:40,domains:2})&&equal(s.original_iterations,[2001,6000])&&s.representation==='mcmc_equal_weight_draws',p,'original empirical representation/iteration identity differs');}
  if(keys(x.state_roles,['state_id_recipe','selection_chain_ids','diagnostic_chain_ids','states_per_role','chain_split_establishes_independence'],`${p}.state_roles`)){
   const s=x.state_roles;assert(equal(s.selection_chain_ids,['1','2'])&&equal(s.diagnostic_chain_ids,['3','4'])&&s.states_per_role===8000,p,'selection/diagnostic chain roles differ');
   assert(s.chain_split_establishes_independence===false,p,'chain split cannot establish independence');
   assert(s.state_id_recipe==='synthetic40:chain=<chain_id>:iteration=<original_iteration>',p,'original state identity recipe differs');}
  if(keys(x.assurance,['arithmetic','numerical_guarantee','intended_posterior_feasibility_certified','independent_validation_claim','original_analysis_executed_in_vignette'],`${p}.assurance`)){
   assert(x.assurance.arithmetic==='Exact rational arithmetic on supplied equal-weight empirical measures.',p,'empirical arithmetic description differs');
   for(const k of ['numerical_guarantee','intended_posterior_feasibility_certified','independent_validation_claim','original_analysis_executed_in_vignette'])assert(x.assurance[k]===false,`${p}.assurance.${k}`,'assurance flag must remain false');}
  if(keys(x.targets,['S','C','orientation','grade_orientation','S_identity_classes','C_identity_classes','C_identity_pairs'],`${p}.targets`)){
   assert(typeof x.targets.S==='string'&&typeof x.targets.C==='string',p,'target descriptions must be text');
   assert(x.targets.orientation==='larger_is_higher'&&x.targets.grade_orientation==='smaller_is_higher_priority',p,'target/grade orientation differs');
   assert(x.targets.S_identity_classes===40&&x.targets.C_identity_classes===38&&equal(x.targets.C_identity_pairs,[['S05','S06'],['S21','S22']]),p,'target-identity classes/pairs differ');}
  keys(x.design,['original_units','original_pairs','column_counts','candidate_product','max_grades','cut_positions','order_rule','candidate_order_uses_selection_states','weights','tau','q','alpha','scope','t'],`${p}.design`);
  if(record(x.design)){
   keys(x.design.column_counts,['S','C'],`${p}.design.column_counts`);
   assert(x.design.original_units===40&&x.design.original_pairs===780&&equal(x.design.column_counts,{S:7,C:7})&&x.design.candidate_product===49&&x.design.max_grades===3,p,'original candidate design differs');
   assert(equal(x.design.cut_positions,[10,20,30])&&x.design.candidate_order_uses_selection_states===true,p,'selection-based candidate order metadata differs');
   assert(equal(x.design.weights,['1/2','1/2'])&&x.design.tau==='1/10'&&x.design.q==='1/20'&&x.design.alpha==='1/20'&&x.design.scope==='all original pairs'&&x.design.t===(index===0?'1/20':'1/10'),p,'saved exact policy differs');}
  const resultKeys=index===0?['N_S','N_C','risk_exact','selection_J_exact','diagnostic_J_exact','selection_union_hits','selection_any_error_hits','diagnostic_union_hits','diagnostic_any_error_hits','optimizer_count','feasible_candidates','C_grade_sizes','first_strict_exceedance_count']:['N_S','N_C','risk_exact','selection_J_exact','diagnostic_J_exact','diagnostic_risk_exact','selection_union_hits','diagnostic_union_hits','optimizer_count','feasible_candidates'];
  keys(x.results,resultKeys,`${p}.results`);
  const expectedStored=index===0?{risk_exact:'170039/2496000',selection_J_exact:'0',diagnostic_J_exact:'0',selection_union_hits:0,selection_any_error_hits:1871,diagnostic_union_hits:0,diagnostic_any_error_hits:1877,optimizer_count:1,feasible_candidates:7,first_strict_exceedance_count:26}:{risk_exact:'716341/12480000',selection_J_exact:'133/4000',diagnostic_J_exact:'229/8000',diagnostic_risk_exact:'717433/12480000',selection_union_hits:266,diagnostic_union_hits:229,optimizer_count:1,feasible_candidates:14};
  for(const [k,v]of Object.entries(expectedStored))assert(x.results?.[k]===v,`${p}.results.${k}`,'stored empirical summary differs; do not recompute from tuples');
  assert(equal(x.domain_ids,['S','C'])&&equal(x.grade_tuple_fields,['unit_id','S','C']),p,'ordered tuple domain schema differs');
  const valid=Array.isArray(x.grade_tuples)&&x.grade_tuples.length===40&&x.grade_tuples.every((r,i)=>Array.isArray(r)&&r.length===3&&r[0]===`S${String(i+1).padStart(2,'0')}`&&r.slice(1).every(g=>Number.isInteger(g)&&g>=1&&g<=3));
  assert(valid,p,'forty original-order integer grade tuples required');if(!valid)continue;
  const G=x.grade_tuples;allGrades.push(G);
  const Ks=[1,2].map(d=>new Set(G.map(r=>r[d])).size);assert(equal(Ks,index===0?[1,3]:[2,3]),p,'occupied domain grade counts differ');
  for(const [a,b]of x.targets?.C_identity_pairs??[])assert(G.find(r=>r[0]===a)?.[2]===G.find(r=>r[0]===b)?.[2],p,'C structural identity pair split across grades');
  const occupancy=Array.from({length:3},()=>Array(index===0?1:2).fill(0));for(const r of G)if(occupancy[r[2]-1]?.[r[1]-1]!==undefined)occupancy[r[2]-1][r[1]-1]++;
  const counts={neither:0,C_only:0,S_only:0,same:0,crossed:0};let NS=0,NC=0,pairs=0;
  for(let i=0;i<40;i++)for(let j=i+1;j<40;j++){const s=Math.sign(G[j][1]-G[i][1]),c=Math.sign(G[j][2]-G[i][2]);NS+=Number(s!==0);NC+=Number(c!==0);counts[s===0&&c===0?'neither':s===0?'C_only':c===0?'S_only':s===c?'same':'crossed']++;pairs++;}
  const derived={occupancy_rows_C_columns_S:occupancy,pair_class_counts:counts,unique_disclosed_pairs:pairs-counts.neither,crossed_pairs:counts.crossed,occupied_cells:occupancy.flat().filter(n=>n>0).length,total_cells:occupancy.flat().length};
  keys(x.derived_display,Object.keys(derived),`${p}.derived_display`);keys(x.derived_display?.pair_class_counts,Object.keys(counts),`${p}.derived_display.pair_class_counts`);
  assert(equal(x.derived_display,derived),p,'tuple-derived occupancy/pair classes differ');assert(equal(spec?.derived,derived),p,'manifest derived display differs');
  assert(pairs===780&&x.results?.N_S===NS&&x.results?.N_C===NC,p,'original-pair/disclosure counts differ');
  rows.push({caseId:id,tuples:G.length,pairs,N_S:NS,N_C:NC});
 }
 return {errors,rows,files:files.size,cases:rows.length};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);let root=MDOMAIN_DATA_CONFIG.root;
 if(args.length){if(args.length!==2||args[0]!=='--root'){console.error('Usage: node verification/check_mdomain_data.mjs [--root directory]');process.exit(2);}root=resolve(args[1]);}
 const r=checkMdomainData({root});for(const error of r.errors)console.error(`FAIL ${error}`);
 console.log(`check_mdomain_data: ${r.cases} saved cards, ${r.rows.reduce((s,r)=>s+r.pairs,0)} original-pair classifications; ${r.errors.length} failure(s)`);process.exitCode=r.errors.length?1:0;
}
