// Fixed public package archives: no recomputation, interpolation, or invented own-report vectors.
import ARCHIVE from '../../data/released/cache-30x3.json' with {type:'json'};
import TUTORIAL from '../../data/released/cache-tutorial.json' with {type:'json'};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
const rows=table=>{const keys=Object.keys(table??{}),n=keys.length?(table[keys[0]]??[]).length:0;if(keys.some(k=>table[k].length!==n))throw new Error('Archived columns differ in length');return Array.from({length:n},(_,i)=>Object.fromEntries(keys.map(k=>[k,table[k][i]])));};
const models=new Map();
export function commonalityArchive(tau=.25){
 if(tau!==.25&&tau!==.35)throw new RangeError('Only the recorded archive prices .25 and .35 are available');
 if(models.has(tau))return models.get(tau);
 const suffix=tau===.35?'_tau35':'',analysis=ARCHIVE.analyses['analysis_30x3'+suffix],commonality=ARCHIVE.analyses['commonality_30x3'+suffix];
 if(analysis.facts.tau!==tau||commonality.facts.tau!==tau||analysis.facts.G_max!==commonality.facts.G_max)throw new Error('Archived commonality and common-report settings differ');
 const model=freeze({key:'archive30-'+tau,route:'Archived pr_example_draws analysis (fixed settings)',analysis,commonality,
  ids:analysis.tables.units.id,grade:analysis.tables.units.grade,n:analysis.facts.n,M:analysis.facts.M,
  tau,cap:analysis.facts.G_max,weights:analysis.facts.weights,costRows:rows(commonality.tables.costs),profileRows:rows(analysis.tables.profile),
  facts:analysis.facts,notice:ARCHIVE.notice,attribution:ARCHIVE.attribution});models.set(tau,model);return model;
}
export function archivedThirtyPath(){const source=ARCHIVE.analyses.frontier_30x3;return freeze({route:'Sparse archived pr_example_draws path (fixed weights/cap)',facts:source.facts,rows:rows(source.tables.path),source:source.source,notice:ARCHIVE.notice});}
export function tutorialSensitivityArchive(){const source=TUTORIAL.analyses.tutorial_sensitivity;if(!source)throw new Error('Tutorial sensitivity archive is absent');return freeze({route:'Archived one-at-a-time tutorial sensitivity (not a full Cartesian grid)',source,notice:TUTORIAL.notice});}
