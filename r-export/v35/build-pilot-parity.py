"""Package independent R pilot results without recomputing expected scientific values.
Author: JoonHo Lee (jlee296@ua.edu).
"""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[2]
p=root/'verification/golden/v35-pilot/manifest.json';m=json.loads(p.read_text());rows=[]
for e in m['fixtures']:
 fpath=root/e['path'];assert hashlib.sha256(fpath.read_bytes()).hexdigest()==e['sha256']
 f=json.loads(fpath.read_text());i=int(f['fixtureId'].rsplit('c',1)[1]);ex=f['expected']
 rows.append(dict(id=f['fixtureId'],args=dict(couplingIndex=i),expect=dict(fit=ex['fit'],selectedEvaluation=ex['selectedEvaluation'],canonicalGrades=ex['fit']['selectedGrades'],fixedCards=ex['fixedCards'])))
body=dict(group='postrank-v35-pilot',uses_postrank=True,reference_package_version='1.2.0',generator='r-export/v35/build-pilot-parity.py',origin_manifest_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),rows=rows)
out=root/'verification/golden/postrank-v35-pilot.json';out.write_text(json.dumps(body,indent=1)+'\n')
record=dict(file=str(out.relative_to(root)),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),rows=len(rows),generator=body['generator'],uses_postrank=True,postrank_version='1.2.0',source_commit=m['sourceCommit'],origin_manifest_sha256=body['origin_manifest_sha256'],scope='All eleven public integer coupling-control settings; complete independent R fits and fixed-card evaluations.')
(root/'verification/golden/manifest.d/postrank-v35-pilot.json').write_text(json.dumps(record,indent=1)+'\n')
print('Packaged',len(rows),'pilot R references')
