"""Package unchanged public-R oracle values for the existing parity runner.

Author: JoonHo Lee (jlee296@ua.edu).
No scientific results are calculated here; the R-exported fixtures are the source.
"""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[2]
manifest_path=root/'verification/golden/v35/manifest.json'
manifest=json.loads(manifest_path.read_text());rows=[]
for entry in manifest['fixtures']:
 path=root/entry['path']
 assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
 f=json.loads(path.read_text());args=dict(fn='mdomainSolve',input=f['input'],decision=f['decision'],family=f['family'],grades=f['expected']['selectedEvaluation']['grades'])
 expect=dict(fit=f['expected']['fit'],selectedEvaluation=f['expected']['selectedEvaluation'],canonicalGrades=f['expected']['selectedEvaluation']['grades'])
 if f['fixtureId']=='dependence-coincident':
  args['checkExample']=True
  expect['exampleMath']=dict(states=f['input']['states'],masses=f['input']['masses'],weights=f['decision']['weights'],tau=f['decision']['tau'],q=f['decision']['q'],t=f['decision']['t'],alpha=f['decision']['alpha'])
 rows.append(dict(id=f['fixtureId'],args=args,expect=expect))
body=dict(group='postrank-v35-mdomain',generator='r-export/v35/build-parity-group.py',uses_postrank=True,reference_package_version='1.2.0',origin_manifest_sha256=hashlib.sha256(manifest_path.read_bytes()).hexdigest(),rows=rows)
out=root/'verification/golden/postrank-v35-mdomain.json';out.write_text(json.dumps(body,indent=1)+'\n')
record=dict(file=str(out.relative_to(root)),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),rows=len(rows),generator='r-export/v35/build-parity-group.py',uses_postrank=True,postrank_version='1.2.0',source_commit=manifest['sourceCommit'],origin_manifest_sha256=body['origin_manifest_sha256'],scope='Packaging of unchanged independent public-R finite-law oracle values; exact parity only.')
(root/'verification/golden/manifest.d/postrank-v35-mdomain.json').write_text(json.dumps(record,indent=1)+'\n')
print('Packaged',len(rows),'independent R oracle rows for exact parity')
