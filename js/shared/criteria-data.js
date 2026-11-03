// Shared immutable released-input adapters; numerical summaries remain public pr-core calls.
import SIX from '../../data/released/six-sites.json' with {type:'json'};
import THIRTY from '../../data/released/thirty-sites.json' with {type:'json'};
import TOY from '../../data/released/toy-joint-draws.json' with {type:'json'};
import {pairCount} from '../pr-core.js';
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
const cache=new Map();
export function criteriaData(key='six'){
 if(!['six','thirty'].includes(key))throw new RangeError('Criteria dataset must be six or thirty');
 if(cache.has(key))return cache.get(key);
 const source=key==='six'?SIX:THIRTY,a=source.arrays[key==='six'?'two':'gaussian'],u=source.tables.units;
 const stems=key==='six'?['A','B']:a.criteria;
 if(a.ids.length!==u.id.length||a.criteria.length!==stems.length)throw new Error('Criteria input dimensions differ');
 const rows=a.ids.map(id=>{const p=u.id.indexOf(id);if(p<0)throw new Error('Criteria unit ID is missing from the profile table');return p;});
 if(new Set(a.ids).size!==a.ids.length||new Set(rows).size!==a.ids.length)throw new Error('Criteria unit IDs are duplicated');
 for(const stem of stems)for(const prefix of ['mean_','sd_'])if(u[prefix+stem]?.length!==u.id.length)throw new Error('Criteria marginal profile is incomplete');
 const E={ids:a.ids.slice(),criteria:a.criteria.slice(),e:a.e.map(m=>m.map(row=>row.map(v=>v===null?NaN:v)))};
 const result=freeze({key,route:key==='six'?'six-site independent Normal law':'thirty-site Gaussian marginal law',
  n:a.ids.length,K:a.criteria.length,M:pairCount(a.ids.length),ids:a.ids.slice(),labels:rows.map((p,i)=>u.label?.[p]??a.ids[i]),
  criteria:a.criteria.slice(),criterionLabels:key==='six'?['score A','score B']:a.criteria.slice(),
  means:rows.map(p=>stems.map(stem=>u['mean_'+stem][p])),sds:rows.map(p=>stems.map(stem=>u['sd_'+stem][p])),E,
  independentCriteria:key==='six',facts:source.facts,notice:source.notice,attribution:source.attribution});
 cache.set(key,result);return result;
}
export function toyJointDraws(){
 const a=TOY.arrays.joint;
 if(a.values.length!==32||a.ids.length!==3||a.criteria.length!==2||a.values.some(s=>s.length!==a.ids.length||s.some(row=>row.length!==a.criteria.length)))throw new Error('The original toy tensor axes differ');
 return freeze({ids:a.ids,criteria:a.criteria,draws:a.values,S:TOY.facts.draws,n:a.ids.length,K:a.criteria.length,facts:TOY.facts,drawIndex:TOY.tables.draws,notice:TOY.notice,attribution:TOY.attribution});
}
/** Explicit input reindexing: move one unit's WHOLE criterion vector, then select the retained prefix. */
export function toyInput({prefix=32,shift=0,unit=1,allUnits=false}={}){
 const source=toyJointDraws();
 if(!Number.isInteger(prefix)||prefix<1||prefix>source.S||!Number.isInteger(shift)||!Number.isInteger(unit)||unit<0||unit>=source.n||typeof allUnits!=='boolean')throw new RangeError('Invalid toy prefix or whole-unit permutation');
 const offset=((shift%source.S)+source.S)%source.S;
 return {ids:source.ids,criteria:source.criteria,draws:source.draws.map((state,s)=>state.map((row,i)=>allUnits||i===unit?source.draws[(s+offset)%source.S][i]:row)).slice(0,prefix),prefix,shift:offset,unit,allUnits};
}
