// Browser-local input and export infrastructure for T.1. Scientific values use existing public core calls.
import {LEAGUE_SEED,drawLeague,league30,normalPosterior} from '../pr-core.js';
import SIX from '../../data/released/six-sites.json' with {type:'json'};

export const YOUR_DATA_PRESETS = Object.freeze([
  {id:'league8-posterior',label:'Eight posterior summaries',example:'league8',format:'posterior',prior:'normal',priorMean:0,priorSd:.15,tau:.2,cap:'3',weights:[1],orient:[1]},
  {id:'league8-flat',label:'Eight estimates, flat prior',example:'league8',format:'estimates',prior:'flat',priorMean:0,priorSd:.15,tau:.2,cap:'3',weights:[1],orient:[1]},
  {id:'league8-normal',label:'Eight estimates, Normal prior',example:'league8',format:'estimates',prior:'normal',priorMean:0,priorSd:.15,tau:.2,cap:'3',weights:[1],orient:[1]},
  {id:'six-probabilities',label:'Two probability matrices',example:'six',format:'probabilities',matrixEvent:'directional_error',prior:'normal',priorMean:0,priorSd:.15,tau:.2,cap:'3',weights:[.5,.5],orient:[1,1]},
  {id:'league30-posterior',label:'Thirty posterior summaries',example:'league30',format:'posterior',prior:'normal',priorMean:0,priorSd:.15,tau:.2,cap:'3',weights:[1],orient:[1]},
  {id:'equal5',label:'All reports tied',example:'equal5',format:'posterior',prior:'normal',priorMean:0,priorSd:.15,tau:.5,cap:'all',weights:[1/3,1/3,1/3],orient:[1,-1,1]},
]);
export const MATRIX_SOURCE_KINDS = Object.freeze(['analytic_reference','numerical_integration','iid_summary','mcmc_summary','published_reference']);
const fail = message => {throw new Error(message)};
const nonempty = s => typeof s==='string' && s.trim()!=='';
const numeric = (s,where) => {if(!nonempty(s))fail(`${where}: a numeric cell is missing.`);const n=Number(s);if(!Number.isFinite(n))fail(`${where}: enter a finite number.`);return n;};
const checkIds = (ids,where) => {if(ids.length<2||ids.length>30)fail(`${where}: enter 2–30 units (found ${ids.length}).`);const seen=new Set();for(let i=0;i<ids.length;i++){if(!nonempty(ids[i]))fail(`${where}, unit ${i+1}: the ID is missing.`);if(ids[i].includes('\0'))fail(`${where}, unit ${i+1}: a null character cannot be used in an ID.`);if(seen.has(ids[i]))fail(`${where}: duplicate unit ID “${ids[i]}”.`);seen.add(ids[i]);}};

// Inspect the first nonblank logical record. Tabs inside a quoted field are data.
function inputDelimiter(text) {
  let quoted=false, hasTab=false, nonblank=false;
  for(const c of text){
    if(c==='"'){quoted=!quoted;nonblank=true;}
    else if(!quoted){
      if(c===',')return ',';
      if(c==='\r'||c==='\n'){if(nonblank)return hasTab?'\t':',';hasTab=false;}
      else if(c==='\t')hasTab=true;
      else if(c.trim())nonblank=true;
    }
  }
  return hasTab?'\t':',';
}

/** Quoted delimiters, doubled quotes, Unicode, CRLF and embedded newlines. */
export function parseCsv(text,delimiter=',') {
  if(typeof text!=='string')fail('Paste CSV text.');
  if(text.includes('\0'))fail('CSV input cannot contain null characters.');
  const rows=[];let row=[],value='',quoted=false,closedQuote=false,fieldStart=true;
  const push=()=>{row.push(value);value='';closedQuote=false;fieldStart=true;};
  for(let i=text.charCodeAt(0)===0xfeff?1:0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closedQuote=true;}}else value+=c;continue;}
    if(c==='"'){if(!fieldStart)fail(`CSV row ${rows.length+1}: a quote must begin a quoted cell.`);quoted=true;fieldStart=false;continue;}
    if(c===delimiter){push();continue;}
    if(c==='\n'||c==='\r'){push();rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;continue;}
    if(closedQuote){if(c===' '||c==='\t')continue;fail(`CSV row ${rows.length+1}: unexpected text after a closing quote.`);}
    value+=c;fieldStart=false;
  }
  if(quoted)fail(`CSV row ${rows.length+1}: the quoted cell is not closed.`);
  if(value!==''||row.length||closedQuote){push();rows.push(row);}
  return rows;
}
export function csvText(rows) {return rows.map(row=>row.map(v=>{const s=v===null||v===undefined||typeof v==='number'&&!Number.isFinite(v)?'':String(v);return /[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}).join(',')).join('\r\n')+'\r\n';}
const isBlank = row => row.every(s=>s.trim()==='');

function records(rows,format) {
  rows=rows.filter(row=>!isBlank(row));if(!rows.length)fail('Paste a header and at least two unit rows.');
  const header=rows[0].map(s=>s.trim()), suffix=format==='posterior'?['mean','sd']:['estimate','se'];
  if(header[0]!=='id')fail('Column 1 must be named id.');
  if(new Set(header).size!==header.length)fail('CSV header: column names must be unique.');
  const criteria=[],columns=new Map();
  header.slice(1).forEach((name,i)=>{const m=/^(.+)_(mean|sd|estimate|se)$/.exec(name);if(!m||!suffix.includes(m[2]))fail(`Column “${name}”: use <criterion>_${suffix[0]} and <criterion>_${suffix[1]}.`);if(!columns.has(m[1])){criteria.push(m[1]);columns.set(m[1],{});}columns.get(m[1])[m[2]]=i+1;});
  if(criteria.length<1||criteria.length>3)fail(`Header: enter 1–3 criteria (found ${criteria.length}).`);
  for(const c of criteria)for(const s of suffix)if(columns.get(c)[s]===undefined)fail(`Header: criterion “${c}” needs ${c}_${s}.`);
  const ids=[],values=[],scales=[];
  rows.slice(1).forEach((row,i)=>{if(row.length!==header.length)fail(`Row ${i+2}: expected ${header.length} columns, found ${row.length}.`);ids.push(row[0]);values.push(criteria.map(c=>numeric(row[columns.get(c)[suffix[0]]],`Row ${i+2}, ${c}_${suffix[0]}`)));scales.push(criteria.map(c=>{const n=numeric(row[columns.get(c)[suffix[1]]],`Row ${i+2}, ${c}_${suffix[1]}`);if(n<=0)fail(`Row ${i+2}, ${c}_${suffix[1]}: ${suffix[1].toUpperCase()} must be above zero.`);return n;}));});
  checkIds(ids,'CSV');return {format,ids,criteria,[suffix[0]]:values,[suffix[1]]:scales};
}
function matrices(rows,{matrixEvent='directional_error',zeroTies=false,margin=0,source}) {
  if(!['higher_priority','directional_error'].includes(matrixEvent))fail('Declare whether cells are higher-priority probabilities or directional errors.');
  if(zeroTies!==true)fail('Declare zero latent equality probability for the supplied matrices.');
  if(margin!==0)fail('Supplied matrices require a zero comparison margin.');
  if(!source||!MATRIX_SOURCE_KINDS.includes(source.kind)||!nonempty(source.description)||!nonempty(source.conditioning))fail('Give the probability source kind, description and conditioning statement.');
  for(const field of ['description','conditioning'])if(source[field].includes('\0'))fail(`Probability source ${field}: null characters are not allowed.`);
  let at=0,ids=null;const criteria=[],probabilities=[];
  while(at<rows.length){while(at<rows.length&&isBlank(rows[at]))at++;if(at===rows.length)break;
    const label=rows[at++];if(label.length!==2||label[0].trim()!=='criterion'||!nonempty(label[1]))fail(`Row ${at}: start each matrix with criterion,<criterion name>.`);
    const criterion=label[1];if(criteria.includes(criterion))fail(`Row ${at}: duplicate criterion “${criterion}”.`);criteria.push(criterion);
    const header=rows[at++];if(!header||header[0].trim()!=='id')fail(`Row ${at}: the matrix header must start with id.`);const axis=header.slice(1);checkIds(axis,`Matrix “${criterion}” columns`);
    if(ids&&(ids.length!==axis.length||ids.some((id,i)=>id!==axis[i])))fail(`Matrix “${criterion}”: column IDs must match the first matrix in the same order.`);ids??=axis;
    const matrix=[];for(let i=0;i<ids.length;i++){const row=rows[at++];if(!row||row.length!==ids.length+1)fail(`Matrix “${criterion}”, row ${i+1}: expected its ID and ${ids.length} cells.`);if(row[0]!==ids[i])fail(`Matrix “${criterion}”, row ${i+1}: expected ID “${ids[i]}” to match the column order.`);matrix.push(ids.map((id,j)=>{if(i===j){if(row[j+1].trim()!=='')fail(`Matrix “${criterion}”, row “${ids[i]}”, column “${id}”: leave the diagonal empty.`);return NaN;}const p=numeric(row[j+1],`Matrix “${criterion}”, row “${ids[i]}”, column “${id}”`);if(p<0||p>1)fail(`Matrix “${criterion}”, row “${ids[i]}”, column “${id}”: probability must be in [0, 1].`);return p;}));}
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)if(Math.abs(matrix[i][j]+matrix[j][i]-1)>1e-12)fail(`Matrix “${criterion}”: reverse cells for “${ids[i]}” and “${ids[j]}” must sum to one within 1e-12; no correction is applied.`);
    probabilities.push(matrix);
  }
  if(criteria.length<1||criteria.length>3)fail(`Enter 1–3 criterion matrices (found ${criteria.length}).`);
  return {format:'probabilities',ids,criteria,probabilities,event:matrixEvent,zeroTies:true,margin:0,source:{...source}};
}
export function parseUserInput(text,options={}) {
  try{const format=options.format??'posterior';if(!['posterior','estimates','probabilities'].includes(format))fail('Choose an input format.');const rows=parseCsv(text,typeof text==='string'?inputDelimiter(text):','),data=format==='probabilities'?matrices(rows,options):records(rows,format);return {ok:true,messages:[],data};}
  catch(error){return {ok:false,messages:[String(error.message??error)],data:null};}
}
export function inputCsv(input) {
  if(input.format==='probabilities')return input.criteria.map((c,k)=>csvText([['criterion',c],['id',...input.ids],...input.ids.map((id,i)=>[id,...input.probabilities[k][i]])])).join('\r\n');
  const a=input.format==='posterior'?'mean':'estimate',b=input.format==='posterior'?'sd':'se';
  return csvText([['id',...input.criteria.flatMap(c=>[`${c}_${a}`,`${c}_${b}`])],...input.ids.map((id,i)=>[id,...input.criteria.flatMap((_,k)=>[input[a][i][k],input[b][i][k]])])]);
}
export function publicYourDataProvenance(example) {
  const source=example==='six'?SIX.attribution:example==='equal5'
    ?'Equal-means synthetic teaching example by JoonHo Lee, postrank Explorer v3.'
    :'Synthetic league for postrank Explorer, JoonHo Lee.';
  return {source,licence:'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)'};
}
export function publicYourDataInput(example='league8',format='posterior') {
  if(example==='six'){
    const a=SIX.arrays.two;return {format:'probabilities',ids:a.ids.slice(),criteria:a.criteria.slice(),probabilities:a.e.map(m=>m.map(row=>row.map(p=>p===null?NaN:p))),event:'directional_error',zeroTies:true,margin:0,source:{kind:'analytic_reference',description:'Released six-site two-criterion tutorial probabilities.',conditioning:'The specified teaching posterior is fixed; zero latent equality and zero comparison margin.'}};
  }
  if(example==='equal5')return {format:'posterior',ids:['A','B','C','D','E'],criteria:['c1','c2','c3'],mean:Array.from({length:5},()=>[0,0,0]),sd:Array.from({length:5},()=>[1,1,1])};
  if(!['league8','league30'].includes(example))fail('Choose a public example.');
  const league=league30(),draw=drawLeague(LEAGUE_SEED),n=example==='league8'?8:30,ids=league.ids.slice(0,n),estimate=draw.estimate.slice(0,n),se=league.se.slice(0,n);
  if(format==='estimates')return {format,ids,criteria:['theta'],estimate:estimate.map(x=>[x]),se:se.map(x=>[x])};
  const posterior=normalPosterior(estimate,se,{priorMean:0,priorSd:.15});return {format:'posterior',ids,criteria:['theta'],mean:posterior.mean.map(x=>[x]),sd:posterior.sd.map(x=>[x])};
}

/** R double-quoted string escaping; user text is never inserted as executable R syntax. */
export function rString(value) {if(typeof value!=='string'||value.includes('\0'))fail('R strings must be text without null characters.');return JSON.stringify(value);}
