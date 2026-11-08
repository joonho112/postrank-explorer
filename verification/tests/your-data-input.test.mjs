import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvText,inputCsv,parseCsv,parseUserInput,publicYourDataInput,rString} from '../../js/shared/your-data-input.js';
const source={kind:'analytic_reference',description:'Declared test input',conditioning:'Fixed input; no estimation claim'};
const options={format:'probabilities',matrixEvent:'directional_error',zeroTies:true,margin:0,source};
const square=(criterion='p',rowIds=['A','B'],cells=[['',.2],[.8,'']])=>csvText([['criterion',criterion],['id',...rowIds],...rowIds.map((id,i)=>[id,...cells[i]])]);

test('CSV preserves quoted commas, doubled quotes, Unicode and embedded CRLF without executing text',()=>{
 const rows=[['id','θ_mean','θ_sd'],['서울, "A"\r\nnext',1,.2],['B|C',2,.3]];
 assert.deepEqual(parseCsv('\ufeff'+csvText(rows)),rows.map(row=>row.map(String)));
 const parsed=parseUserInput(csvText(rows));assert.equal(parsed.ok,true);assert.deepEqual(parsed.data.ids,['서울, "A"\r\nnext','B|C']);
 assert.deepEqual(parseUserInput(inputCsv(parsed.data)).data,parsed.data);
 assert.equal(parseUserInput('id,c_mean,c_sd\n"unclosed,1,.1\nB,2,.2').ok,false);
 assert.equal(parseUserInput('id,c_mean,c_sd\n"A"oops,1,.1\nB,2,.2').ok,false);
});

test('spreadsheet TSV accepts quoted tabs, commas, Unicode and CRLF in records and matrices',()=>{
 const rows=parseUserInput('\ufeff\r\n"id"\t"θ_mean"\t"θ_sd"\r\n"A\t서울, ""quoted"""\t1\t.1\r\nB\t2\t.2');
 assert.equal(rows.ok,true);assert.deepEqual(rows.data.ids,['A\t서울, "quoted"','B']);assert.deepEqual(rows.data.mean,[[1],[2]]);
 const matrices=parseUserInput('criterion\t"A,B"\r\nid\tA\tB\r\nA\t\t.2\r\nB\t.8\t\r\n',options);
 assert.equal(matrices.ok,true);assert.deepEqual(matrices.data.criteria,['A,B']);assert.equal(matrices.data.probabilities[0][1][0],.8);
 assert.equal(parseUserInput('"id"\t,c_mean,c_sd\nA,1,.1\nB,2,.2').ok,true,'tabs after a quoted CSV header stay valid');
});

test('record checks identify failed rows/columns and retain the declared interpretation',()=>{
 const examples=[['id,c_mean,c_sd\nA,,1\nB,2,1','Row 2, c_mean'],['id,c_mean,c_sd\nA,1,0\nB,2,1','Row 2, c_sd'],['id,c_mean,c_sd\nA,Infinity,1\nB,2,1','finite number'],['id,c_mean,c_sd\nA,1,1\nA,2,1','duplicate unit ID'],['id,c_mean,c_sd\nA,1,1,2\nB,2,1','expected 3 columns'],['id,c_mean\nA,1\nB,2','needs c_sd'],['id,c_mean,c_sd,c_sd\nA,1,1,1\nB,2,1,1','unique'],['id,c_mean,c_sd\nA,1,1','2–30 units']];
 for(const[text,message]of examples){const result=parseUserInput(text);assert.equal(result.ok,false,text);assert.ok(result.messages[0].includes(message),result.messages[0]);assert.equal(result.data,null);}
 const tooMany=csvText([['id','c_mean','c_sd'],...Array.from({length:31},(_,i)=>[`U${i}`,i,1])]);assert.ok(parseUserInput(tooMany).messages[0].includes('2–30'));
 const raw=parseUserInput('id,θ_estimate,θ_se\nA,1,.2\nB,2,.3',{format:'estimates'});assert.equal(raw.ok,true);assert.deepEqual(raw.data.estimate,[[1],[2]]);assert.equal(raw.data.mean,undefined);
 const four=csvText([['id',...['a','b','c','d'].flatMap(c=>[`${c}_mean`,`${c}_sd`])],['A',0,1,0,1,0,1,0,1],['B',0,1,0,1,0,1,0,1]]);assert.ok(parseUserInput(four).messages[0].includes('1–3 criteria'));
});

test('supplied matrices require event/equality/margin/source declarations and aligned complete axes',()=>{
 const input=square()+ '\r\n'+square('q',['A','B'],[['',0],[1,'']]);
 const result=parseUserInput(input,options);assert.equal(result.ok,true);assert.equal(result.data.probabilities.length,2);assert.ok(Number.isNaN(result.data.probabilities[0][0][0]));assert.equal(result.data.mean,undefined);assert.deepEqual(parseUserInput(inputCsv(result.data),options).data,result.data);
 for(const patch of[{zeroTies:false},{margin:.1},{matrixEvent:'unknown'},{source:null}])assert.equal(parseUserInput(input,{...options,...patch}).ok,false);
 for(const field of ['description','conditioning'])assert.ok(parseUserInput(input,{...options,source:{...source,[field]:'unsafe\0source'}}).messages[0].includes('null characters'));
 assert.ok(parseUserInput(square('p',['A','B'],[[0,.2],[.8,'']]),options).messages[0].includes('diagonal empty'));
 assert.ok(parseUserInput(square('p',['A','B'],[['',1.1],[.8,'']]),options).messages[0].includes('[0, 1]'));
 assert.ok(parseUserInput(square('p',['A','B'],[['',.2],[.7,'']]),options).messages[0].includes('reverse cells'));
 assert.ok(parseUserInput(square()+ '\r\n'+square('q',['B','A']),options).messages[0].includes('same order'));
 assert.ok(parseUserInput(square().replace('A,,','Z,,'),options).messages[0].includes('expected ID'));
 const near=square('p',['A','B'],[['',.2],[.8000000000005,'']]);const kept=parseUserInput(near,options);assert.equal(kept.ok,true);assert.equal(kept.data.probabilities[0][1][0],.8000000000005,'validation applies no correction');
});

test('R escaping treats names and hostile-looking input only as strings',()=>{
 for(const value of['서울, "A"','a\\b\nnext','";system("unused");#','θ_1','line\tbreak']){const quoted=rString(value);assert.equal(JSON.parse(quoted),value);assert.equal(quoted[0],'"');assert.equal(quoted.at(-1),'"');}
 assert.throws(()=>rString('A\0B'),/null/);
});

test('public examples use the original unequal-precision league and full declared axes',()=>{
 const p=publicYourDataInput('league8'),r=publicYourDataInput('league8','estimates');assert.equal(p.ids[0],'U01');assert.equal(p.ids.at(-1),'U08');assert.deepEqual(p.criteria,['theta']);assert.deepEqual(r.se.slice(0,3),[[.2],[.1],[.05]]);assert.equal(publicYourDataInput('league30').ids.length,30);
 const six=publicYourDataInput('six');assert.equal(six.criteria.length,2);assert.equal(six.probabilities.length,2);assert.equal(six.ids.length,6);
 const eq=publicYourDataInput('equal5');assert.deepEqual(eq.criteria,['c1','c2','c3']);assert.deepEqual(eq.mean,Array.from({length:5},()=>[0,0,0]));assert.deepEqual(eq.sd,Array.from({length:5},()=>[1,1,1]));
});
