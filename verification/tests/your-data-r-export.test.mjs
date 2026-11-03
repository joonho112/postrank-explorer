import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {yourDataR} from '../../js/shared/your-data-r-export.js';
import {errorArray,normalInterval} from '../../js/pr-core.js';
import {publicYourDataInput} from '../../js/shared/your-data-input.js';
const ROOT=resolve(import.meta.dirname,'../..');
const rows=JSON.parse(readFileSync(join(ROOT,'verification/golden/oracle-v3p5-tools.json'),'utf8')).rows;
const decode=x=>Array.isArray(x)?x.map(decode):x===null?NaN:x;
const close=(a,b)=>{if(b===null)return assert.equal(a,null);assert.ok(Math.abs(a-b)<=1e-12,`${a} versus independent ${b}`);};
function replay(model,grade,runSearch){
 const dir=mkdtempSync(join(tmpdir(),'prx-r-export-'));
 try{
  const script=join(dir,'replay.R'),output=join(dir,'result.json');
  const capture=`\nout <- list(ids = ids, criteria = criteria, e = lapply(seq_along(criteria), function(k) unname(e[,,k])), grade = unname(browser_grade), input = entered_input, weights = unname(weights), tau = settings$tau, means = if(is.null(supplied_summaries)) NULL else unname(supplied_summaries$means), lower = if(is.null(supplied_summaries)) NULL else unname(supplied_summaries$lower), upper = if(is.null(supplied_summaries)) NULL else unname(supplied_summaries$upper), N = browser_evaluation$N, E = unname(browser_evaluation$E), EoverN = unname(browser_evaluation$E_over_N), risk = browser_evaluation$primary_risk, fitted = exists('fit', inherits = FALSE))\nwriteLines(jsonlite::toJSON(out, auto_unbox = FALSE, digits = 17, na = 'null', null = 'null'), ${JSON.stringify(output)})\n`;
  writeFileSync(script,`.libPaths(c(${JSON.stringify(process.env.POSTRANK_LIB || join(ROOT,'.R-library'))},.libPaths()))\n`+yourDataR(model,grade,{runSearch})+capture);
  const result=spawnSync('Rscript',[script],{cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:2e6});
  assert.equal(result.status,0,result.stderr+'\n'+result.stdout);return JSON.parse(readFileSync(output,'utf8'));
 }finally{rmSync(dir,{recursive:true,force:true});}
}

test('public exports replay the exact applied arrays and fixed report in postrank 1.1.0',()=>{
 for(const row of rows.filter(r=>/^tool-your-(league8-posterior|league8-flat|league8-normal|six-probabilities|league30-posterior|equal5)$/.test(r.id))){
  const a=row.args,x=row.expect,input=publicYourDataInput(a.example,a.format),model={E:{...x.E,e:decode(x.E.e)},posterior:x.posterior,input,settings:{tau:a.tau,cap:String(a.cap),weights:a.w,orient:a.orient,prior:a.prior,priorMean:0,priorSd:.15,timeLimit:.1},method:x.method,order:x.order,blocks:x.blocks};
  const actual=replay(model,x.optimum.grade,row.id.includes('league30'));
  assert.deepEqual(actual.ids,x.E.ids);assert.deepEqual(actual.criteria,x.E.criteria);assert.deepEqual(actual.e,x.E.e,'all cells, including the unused diagonal, retain orientation and exact numeric values');assert.deepEqual(actual.grade,x.optimum.grade);assert.deepEqual(actual.weights,a.w);assert.equal(actual.tau[0],a.tau);assert.equal(actual.N[0],x.optimum.evaluation.N);close(actual.risk[0],x.optimum.evaluation.risk);actual.E.forEach((v,k)=>close(v,x.optimum.evaluation.E[k]));actual.EoverN.forEach((v,k)=>close(v,x.optimum.evaluation.EoverN[k]));
  assert.deepEqual(actual.input.ids,input.ids);assert.deepEqual(actual.input.criteria,input.criteria);for(const field of ['mean','sd','estimate','se','probabilities'])if(input[field])assert.deepEqual(actual.input[field],JSON.parse(JSON.stringify(input[field])),`original ${field} retained exactly`);
  if(!x.posterior){assert.equal(actual.means,null);assert.equal(actual.lower,null);assert.equal(actual.upper,null);}else for(let i=0;i<x.E.ids.length;i++)for(let k=0;k<a.orient.length;k++){assert.equal(actual.means[i][k],(a.orient[k]*x.posterior.mean[i][k])||0);assert.equal(actual.lower[i][k],a.orient[k]<0?-x.posterior.upper[i][k]:x.posterior.lower[i][k]);assert.equal(actual.upper[i][k],a.orient[k]<0?-x.posterior.lower[i][k]:x.posterior.upper[i][k]);}
  if(row.id.includes('league30'))assert.deepEqual(actual.fitted,[true],'the exact frozen-order DP call runs in the actual package');
 }
});

test('R replay preserves difficult decimals, Unicode IDs and hostile-looking strings as data',()=>{
 const ids=['서울, "A"\nnext','B|C'],criteria=['θ_1'],source={kind:'analytic_reference',description:'";stop("user text executed");#',conditioning:'Quoted \\ path and\nnew line'};
 const E={ids,criteria,e:[[[NaN,.19999999999999998],[.8,NaN]]]},model={E,posterior:null,input:{format:'probabilities',ids,criteria,probabilities:E.e,event:'directional_error',zeroTies:true,margin:0,source},settings:{tau:.19999999999999998,cap:'all',weights:[1],orient:[-1],timeLimit:.1},method:'enumeration'};
 const actual=replay(model,[1,2],false);assert.deepEqual(actual.ids,ids);assert.equal(actual.e[0][0][1],.19999999999999998);assert.equal(actual.tau[0],.19999999999999998);assert.deepEqual(actual.input.source.description,[source.description]);assert.deepEqual(actual.input.source.conditioning,[source.conditioning]);
});

test('the exported bounded joint search runs on a declared small family without changing the displayed report',()=>{
 const E={ids:['A','B'],criteria:['score'],e:[[[NaN,.1],[.9,NaN]]]},model={E,posterior:null,input:{format:'probabilities',ids:E.ids,criteria:E.criteria,probabilities:E.e,event:'directional_error',zeroTies:true,margin:0,source:{kind:'analytic_reference',description:'Declared two-unit reference',conditioning:'Fixed source probabilities'}},settings:{tau:.2,cap:'all',weights:[1],orient:[1],timeLimit:.1},method:'unrestricted-solver'};
 const actual=replay(model,[1,2],true);assert.deepEqual(actual.fitted,[true]);assert.deepEqual(actual.grade,[1,2]);close(actual.risk[0],.1);
});

test('nonzero reversed targets retain the original summaries and invert both interval ends correctly',()=>{
 const input={format:'posterior',ids:['A','B'],criteria:['up','down'],mean:[[1,2],[-3,.7]],sd:[[.2,.4],[.8,.3]]},orient=[1,-1];
 const intervals=input.criteria.map((_,k)=>normalInterval(input.mean.map(r=>r[k]),input.sd.map(r=>r[k]),.9));
 const posterior={mean:input.mean,sd:input.sd,lower:input.ids.map((_,i)=>intervals.map(c=>c.lower[i])),upper:input.ids.map((_,i)=>intervals.map(c=>c.upper[i]))};
 const E=errorArray(input.mean,input.sd,{ids:input.ids,criteria:input.criteria,orient}),model={E,posterior,input,settings:{tau:.2,cap:'2',weights:[.5,.5],orient},method:'enumeration'};
 const actual=replay(model,[1,2],false);assert.deepEqual(actual.means,[[1,-2],[-3,-.7]]);
 for(let i=0;i<2;i++){assert.equal(actual.lower[i][1],-posterior.upper[i][1]);assert.equal(actual.upper[i][1],-posterior.lower[i][1]);}
 assert.deepEqual(actual.e,E.e.map(m=>m.map(row=>row.map(v=>Number.isNaN(v)?null:v))));
});
