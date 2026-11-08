"""Derive display-only fictional cards from the permitted postrank1.2 asset.

Author: JoonHo Lee (jlee296@ua.edu).
This program never reconstructs posterior states or fits a statistical model.
"""
import argparse,hashlib,itertools,json
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--asset',type=Path,required=True)
p.add_argument('--out',type=Path,default=Path('data/precomputed/v35'))
p.add_argument('--source-commit',default='da02a785f753efb060e149f04650970b0ea1e05b')
a=p.parse_args();b=json.loads(a.asset.read_text());a.out.mkdir(parents=True,exist_ok=True)
reports={}
for case in b['cases']:
 prefix='primary' if case['case_id']=='main-alpha-1_20' else 'wide'
 rows=[[g['unit_id'],g[prefix+'_S'],g[prefix+'_C']]for g in b['grades']]
 assert len(rows)==40 and len({r[0]for r in rows})==40
 counts=dict.fromkeys(['neither','C_only','S_only','same','crossed'],0)
 ns=nc=0
 for left,right in itertools.combinations(rows,2):
  ds=left[1]-right[1];dc=left[2]-right[2]
  ns+=ds!=0;nc+=dc!=0
  key='neither'if ds==dc==0 else 'C_only'if ds==0 else 'S_only'if dc==0 else 'same'if ds*dc>0 else 'crossed'
  counts[key]+=1
 ks=max(r[1]for r in rows);kc=max(r[2]for r in rows)
 cells=[[sum(r[1]==s and r[2]==c for r in rows)for s in range(1,ks+1)]for c in range(1,kc+1)]
 derived=dict(occupancy_rows_C_columns_S=cells,pair_class_counts=counts,unique_disclosed_pairs=780-counts['neither'],crossed_pairs=counts['crossed'],occupied_cells=sum(v>0 for row in cells for v in row),total_cells=ks*kc)
 assert sum(counts.values())==780 and (ns,nc)==(case['N_S'],case['N_C'])
 if prefix=='wide':assert all(derived[k]==v for k,v in b['wide_profiles'].items())
 orig=b['original_source']
 payload=dict(schema_version='postrank-integration-card-1.2.0-v1',package_version='1.2.0',case_id=case['case_id'],case_role='primary'if prefix=='primary'else'sensitivity',runtime_postrank_object=False,purpose=b['purpose'],attribution=b['attribution'],source_identity={k:orig[k]for k in ['repository_commit','sha256','original_dimensions','representation','original_iterations']},targets=b['targets'],domain_ids=['S','C'],grade_tuple_fields=['unit_id','S','C'],grade_tuples=rows,design={**b['design'],'t':case['t']},state_roles={k:orig[k]for k in ['state_id_recipe','selection_chain_ids','diagnostic_chain_ids','states_per_role','chain_split_establishes_independence']},results={k:v for k,v in case.items()if k not in ['case_id','t']},derived_display=derived,assurance=b['assurance'])
 assert payload['assurance']['numerical_guarantee'] is False and payload['runtime_postrank_object'] is False
 path=a.out/(case['case_id']+'.json');path.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n')
 reports[case['case_id']]=dict(path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),pairsChecked=780,derived=derived)
manifest=dict(schema_version='postrank-explorer-frozen-display-v1',source_package='postrank',source_version='1.2.0',bundled_asset='extdata/mdomain/synthetic40-card.json',bundled_asset_sha256=hashlib.sha256(a.asset.read_bytes()).hexdigest(),cases=reports,source_public_package_commit=a.source_commit,generator='r-export/v35/build-display-payloads.py',scope='Frozen fictional display only. Pair/grid consistency, not a new model analysis or certificate.')
(a.out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('PASS: two display payloads,780 pair checks each; no raw states or runtime fit objects')
