import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDataNum, parseExactDataNum, compareExactValues, exactDisplayProblem, badTokenFindings, displayFindings } from '../dom_rules.mjs';
import { loadSources, resolveExpectation, mdomainSourceRegistry, checkCaseFile, validateSchema } from '../check_readouts.mjs';
import { makeWindow } from '../dom-env.mjs';
import { createWidget } from '../../js/shared/base.js';

const src = await loadSources();
const exactExpectation = (patch = {}) => ({ select:'[data-test-exact]', kind:'exact', source:'mdomain', ref:{fixture:'dependence-disjoint',field:'fit.riskExact'}, value:'7/40', ...patch });
function element(doc, raw, display, {style='fraction',digits=4,metadata=true}={}) {
 const e=doc.createElement('span');e.setAttribute('data-test-exact','');e.setAttribute('data-num',raw);e.textContent=display;
 if(metadata){e.setAttribute('data-prx-format','mdomain-exact');e.setAttribute('data-prx-exact-style',style);e.setAttribute('data-prx-exact-digits',String(digits));}
 return e;
}
function documentWith(raw, display, options={}) {
 const m=makeWindow({plot:false});m.el.append(element(m.doc,raw,display,options));return m;
}
const caseDoc = (expect=exactExpectation()) => ({app:'mdomain-review-fixture',catalog:null,module:'verification/fixtures/readout-app/readout-app.js',cases:[{id:'exact',query:'',expect:[expect]}]});
function widget(raw,display,options={}) {return {mountWidget(el,spec){return createWidget(el,spec,{name:'mdomain-review-fixture',className:'mdomain-review',keys:{},build(ctx){ctx.readout.set([element(el.ownerDocument,raw,display,options)]);return{render(){}};}});}};}
async function run(raw,display,{expect=exactExpectation(),...options}={}) {return checkCaseFile(caseDoc(expect),{src,module:widget(raw,display,options)});}

for(const [raw,value]of [['NA',null],['0',0],['-2',-2],['.25',undefined],['0.25',.25],['1e-17',1e-17],['9007199254740993',9007199254740993n]])test(`legacy data-num type remains ${raw}`,()=>{const parsed=parseDataNum(raw);if(value===undefined)assert.equal(parsed.ok,false);else{assert.equal(parsed.ok,true);assert.equal(parsed.value,value);}});
test('legacy comma vectors retain Number, null and BigInt members',()=>{assert.deepEqual(parseDataNum('1,NA,9007199254740993').value,[1,null,9007199254740993n]);});
test('canonical fraction transport retains exact strings and unbounded output length',()=>{assert.deepEqual(parseDataNum('7/40'),{ok:true,value:'7/40',list:false,exact:true});const huge='1/'+('1'+'0'.repeat(600)+'1');assert.ok(parseExactDataNum(huge));assert.equal(parseDataNum(huge).value,huge);});
for(const raw of ['2/4','0/2','1/1','1/0','-1/2','+1/2','01/2','1/02','1/2 ','1 /2','1//2','3/0.2'])test(`malformed or noncanonical exact data-num rejects ${raw}`,()=>{assert.equal(parseDataNum(raw).ok,false);assert.equal(parseExactDataNum(raw),null);});
test('canonical integer exact values and null compare without projections',()=>{assert.equal(compareExactValues('0','0'),null);assert.equal(compareExactValues('9007199254740993','9007199254740993'),null);assert.equal(compareExactValues('NA',null),null);assert.ok(compareExactValues('0',null));assert.ok(compareExactValues('00','0'));});
test('a wrong rational whose Number projection agrees still fails exact oracle equality',()=>{const bad='175000000000000001/1000000000000000000';assert.equal(Number(bad.split('/')[0])/Number(bad.split('/')[1]),7/40);assert.ok(compareExactValues(bad,'7/40'));});
for(const [raw,digits,display]of [['1/8',2,'.12'],['3/8',2,'.38'],['1/200',2,'.00'],['3/200',2,'.02'],['7/40',4,'.1750'],['1/3',20,'.33333333333333333333'],['1',4,'1.0000'],['0',4,'0']])test(`independent exact decimal rounding ${raw} at ${digits}`,()=>{assert.equal(exactDisplayProblem(display,raw,{style:'decimal',digits}),null);assert.ok(exactDisplayProblem(display+'1',raw,{style:'decimal',digits}));});
test('fraction display is canonical text rather than an approximately equivalent fraction',()=>{assert.equal(exactDisplayProblem('7/40','7/40'),null);assert.ok(exactDisplayProblem('14/80','7/40'));});
test('generic DOM accepts a raw fraction with exact decimal metadata',()=>{const m=documentWith('7/40','.1750',{style:'decimal'});try{assert.deepEqual(badTokenFindings(m.el),[]);assert.deepEqual(displayFindings(m.el),[]);}finally{m.restore();}});
test('generic DOM catches rounded-display and raw-canonicality planted faults',()=>{for(const [raw,display,rule]of [['7/40','.1749','display'],['14/80','.1750','raw'],['7/0','.1750','raw'],['0.175','.1750','raw']]){const m=documentWith(raw,display,{style:'decimal'});try{assert.ok((rule==='raw'?badTokenFindings(m.el):displayFindings(m.el)).length);}finally{m.restore();}}});
test('undefined exact ratio displays the scope-specific NA text',()=>{assert.equal(exactDisplayProblem('NA: no disclosure','NA'),null);assert.ok(exactDisplayProblem('0','NA'));});
test('original public-R source and request parameters resolve with exact semantics',()=>{assert.deepEqual(resolveExpectation(exactExpectation(),src).problems,[]);assert.equal(resolveExpectation(exactExpectation({ref:{fixture:'dependence-disjoint',field:'input.masses.0'},value:'4/5'}),src).value,'4/5');assert.deepEqual(resolveExpectation(exactExpectation({ref:{fixture:'dependence-disjoint',field:'fixedCards.0.evaluation.domains.0.expectedFalseProportionExact'},value:null}),src).problems,[]);});
test('an explicit tolerance cannot conceal a wrong exact case value',()=>{assert.ok(resolveExpectation(exactExpectation({tol:1}),src).problems.some(x=>/tolerance/.test(x)));assert.ok(resolveExpectation(exactExpectation({value:'175000000000000001/1000000000000000000'}),src).problems.some(x=>/disagrees/.test(x)));});
test('multidomain rational strings cannot downgrade to approximate number kind',()=>{assert.ok(resolveExpectation(exactExpectation({kind:'number',format:{fn:'formatProb'}}),src).problems.some(x=>/kind exact/.test(x)));});
test('readout schema permits stable P collection IDs and exact source refs',()=>{const doc=caseDoc();doc.catalog='P.3';delete doc.module;assert.deepEqual(validateSchema(doc,src.schema,{schema:src.schema,path:'$'}),[]);});
test('manifest source checks actual fixture bytes and rejects tampering',()=>{const registry=mdomainSourceRegistry({read(path){const bytes=readFileSync(new URL('../../'+path,import.meta.url));return path.endsWith('/dependence-disjoint.json')?Buffer.from(bytes.toString('utf8').replace('7/40','1/4')):bytes;}});assert.throws(()=>registry('dependence-disjoint'),/SHA-256 mismatch/);});
test('manifest source rejects unlisted names and path traversal',()=>{assert.throws(()=>src.mdomain('../dependence-disjoint'),/manifest-listed/);assert.throws(()=>src.mdomain('not-a-fixture'),/manifest-listed/);});
test('canonical fraction and decimal exact readouts pass the complete checker',async()=>{for(const [text,options]of [['7/40',{}],['.1750',{style:'decimal'}]])assert.deepEqual((await run('7/40',text,options)).findings,[]);});
test('near-equal wrong rational is caught as raw even with an identical decimal display',async()=>{const result=await run('175000000000000001/1000000000000000000','.1750',{style:'decimal'});assert.ok(result.findings.some(x=>x.rule==='raw'));});
test('unreduced and zero-denominator raw faults fail the complete checker',async()=>{for(const raw of ['14/80','7/0'])assert.ok((await run(raw,'.1750',{style:'decimal'})).findings.some(x=>x.rule==='bad-data-num'));});
test('wrong rounded display and missing exact metadata fail',async()=>{assert.ok((await run('7/40','.1749',{style:'decimal'})).findings.some(x=>x.rule==='display'));assert.ok((await run('7/40','7/40',{metadata:false})).findings.some(x=>x.rule==='display'));});
test('null exact oracle requires raw NA and the no-disclosure display',async()=>{const expect=exactExpectation({ref:{fixture:'dependence-disjoint',field:'fixedCards.0.evaluation.domains.0.expectedFalseProportionExact'},value:null});assert.deepEqual((await run('NA','NA: no disclosure',{expect,style:'decimal'})).findings,[]);assert.ok((await run('0','0',{expect})).findings.some(x=>x.rule==='raw'));});

test('undefined exact case values remain JSON null and metadata limits still apply',()=>{assert.ok(resolveExpectation(exactExpectation({ref:{fixture:'dependence-disjoint',field:'fixedCards.0.evaluation.domains.0.expectedFalseProportionExact'},value:'NA'}),src).problems.some(x=>/must be null/.test(x)));assert.ok(exactDisplayProblem('NA: no disclosure','NA',{style:'decimal',digits:21}));});
test('multidomain source refs cannot follow inherited object fields',()=>{assert.ok(resolveExpectation(exactExpectation({ref:{fixture:'dependence-disjoint',field:'constructor.name'}}),src).problems.some(x=>/declared JSON fields/.test(x)));});
