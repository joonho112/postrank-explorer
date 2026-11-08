// Author: JoonHo Lee (jlee296@ua.edu).
// Independent references are frozen public-R JSON and saved display payloads only.
// No application solver or renderer is imported by this oracle/validator module.
import {readFileSync} from 'node:fs';

const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const views=read('verification/golden/postrank-v35-profile-views.json');
export const commonCases=views.rows.filter(r=>r.args.kind==='common');
export const separabilityCases=views.rows.filter(r=>r.args.kind==='separable');
export const frozenFixture=id=>read(`verification/golden/v35/${id}.json`);
export const resolutionFixture=(law,budget)=>frozenFixture(`resolution-k${law}-a${budget}`);
export const dependenceFixture=index=>read(`verification/golden/v35-pilot/dependence-c${index}.json`);
export function fictionalReference(scenario){
 const reference=read('verification/golden/postrank-v35-fictional-display.json').rows.find(r=>r.id===`fictional-${scenario}`).expect;
 const payload=read(`data/precomputed/v35/${scenario==='primary'?'main-alpha-1_20':'sensitivity-t-wide'}.json`);
 return {reference,payload};
}
export const rationalValue=raw=>{const[n,d='1']=String(raw).split('/');return Number(n)/Number(d);};

/** Serializable extractor: use the SAME representation in jsdom mutation tests and real Chrome.
 * Reads stage marks, real geometry and primary summary; hidden audit tables never supply marks.
 */
export function extractProfileVisualModel(root=document.querySelector('.prx-widget')){
 const doc=root.ownerDocument,win=doc.defaultView,stage=root.querySelector('[data-mdv-stage]');
 const rect=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,top:b.top,bottom:b.bottom};};
 const visible=n=>{for(let p=n;p;p=p.parentElement){if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(n))return false;const s=win.getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;}return true;};
 const browserGeometry=typeof stage.querySelector('svg text')?.getScreenCTM==='function';
 const item=n=>({tag:n.tagName.toLowerCase(),a:Object.fromEntries([...n.attributes].map(a=>[a.name,a.value])),d:{...n.dataset},box:rect(n),visible:browserGeometry?visible(n):true,text:n.tagName.toLowerCase()==='text'?n.textContent:undefined});
 const svgs=[...stage.querySelectorAll('[data-mdv-graphic]')].map(svg=>({...item(svg),marks:[...svg.querySelectorAll('*')].map(item)}));
 const cards=[...stage.querySelectorAll('[data-mdv-report-id]')].map(n=>({...item(n),label:n.querySelector('.mdv-report-label')?.textContent,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth,lines:[...n.querySelectorAll('.mdv-report-line')].map(t=>t.textContent)}));
 const hasLayout=rect(stage).width>0&&typeof stage.querySelector('svg text')?.getScreenCTM==='function';
 const svgFonts=[...stage.querySelectorAll('svg text')].filter(visible).map(n=>hasLayout?parseFloat(win.getComputedStyle(n).fontSize)*Math.hypot(n.getScreenCTM().a,n.getScreenCTM().b):Number(n.getAttribute('font-size')));
 const htmlFonts=hasLayout?[...stage.querySelectorAll('*')].filter(n=>n.namespaceURI!=='http://www.w3.org/2000/svg'&&visible(n)&&[...n.childNodes].some(c=>c.nodeType===3&&/[A-Za-z0-9]/.test(c.textContent))).map(n=>parseFloat(win.getComputedStyle(n).fontSize)):[];
 return {svgs,cards,scopeMasses:[...root.querySelectorAll('[data-mdp-state-mass]')].map(n=>({...item(n),raw:n.dataset.num})),scopeNumbers:[...root.querySelectorAll('[data-mdv-scope] [data-num]')].map(n=>n.dataset.num),summary:root.querySelector('.prx-readout')?.textContent,stage:rect(stage),widget:rect(root),summaryBox:rect(root.querySelector('.prx-readout')),hasLayout,
  overflow:doc.documentElement.scrollWidth-win.innerWidth,viewportHeight:win.innerHeight,viewportWidth:win.innerWidth,
  visibleTables:[...root.querySelectorAll('table')].filter(visible).length,controls:[...root.querySelector('[data-prx-part=controls]').querySelectorAll('input,select,button')].filter(visible).length,
  disclosures:[...root.querySelectorAll('[data-mdv-details]')].map(n=>({key:n.dataset.mdvDetails,tag:n.tagName.toLowerCase(),open:n.open,summary:n.firstElementChild?.tagName.toLowerCase()})),
  svgFonts,htmlFonts};
}
const nodes=m=>m.svgs.flatMap(s=>s.marks);
const role=(m,r)=>nodes(m).filter(n=>n.d.mdvRole===r);
const num=(n,a)=>Number(n?.a[a]);
const sorted=v=>[...v].sort();
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6;
function checks(){const findings=[];return {findings,check(ok,code,detail){if(!ok)findings.push({code,detail});}};}
function optimizers(c,model,expected,canonical,family){
 c.check(eq(model.map(n=>n.d[family==='resolution'?'prrOptimizer':'pcdOptimizer']),expected),'optimizer-set',family);
 c.check(eq(model.filter(n=>n.d[family==='resolution'?'prrCanonical':'pcdCanonical']==='true').map(n=>n.d[family==='resolution'?'prrOptimizer':'pcdOptimizer']),[canonical]),'canonical',family);
}
function cardDirections(c,cards,table){for(const card of cards){const id=card.d.mdvReportId,row=table.find(r=>r.candidateId===id);if(!row){c.check(false,'report-card-id',id);continue;}const g=row.grades;const lines=['S','C'].map((domain,d)=>`${domain}: ${g.values[0][d]===g.values[1][d]?'Withheld':g.values[0][d]<g.values[1][d]?`${g.unitIds[0]} → ${g.unitIds[1]}`:`${g.unitIds[1]} → ${g.unitIds[0]}`}`);c.check(eq(card.lines,lines),'report-card-directions',id);}}

export function commonVisualFindings(model,fixture){
 const c=checks(),svg=model.svgs[0],table=fixture.expected.fit.candidateTable;
 if(!svg)return[{code:'primary-svg'}];
 const width=num(svg,'width'),left=23,span=width-46,max=1/4;
 c.check(svg.d.pcdLossMax==='1/4'&&Number(svg.d.pcdLossLeft)===left&&close(Number(svg.d.pcdLossWidth),span),'loss-axis');
 for(const [family,fit]of [['common',fixture.expected.comparisons[0]],['profile',fixture.expected.fit]]){
  const loss=role(model,`${family}-loss`);c.check(loss.length===1,'loss-mark-count',family);
   for(const mark of loss){c.check(mark.visible,'primary-mark-visible',family);c.check(mark.d.mdvExact===fit.riskExact,'loss-raw',family);c.check(close(num(mark,'x'),left),'loss-baseline',family);c.check(close(num(mark,'width'),rationalValue(fit.riskExact)/max*span),'loss-width',family);c.check(num(mark,'height')>0,'loss-height',family);}
  const expected=table.find(r=>r.candidateId===fit.selectedId).grades,marks=role(model,`${family}-grade`);
  c.check(marks.length===4,'grade-mark-count',family);
  const seen=[];
  for(const mark of marks){const u=expected.unitIds.indexOf(mark.d.mdvUnit),d=['S','C'].indexOf(mark.d.mdvDomain);seen.push(`${u}:${d}`);const grade=expected.values[u]?.[d];c.check(mark.visible,'primary-mark-visible',family);c.check(mark.tag==='circle'?num(mark,'r')>0:num(mark,'width')>0&&num(mark,'height')>0,'grade-glyph-size',family);c.check(mark.d.mdvExact===String(grade)&&mark.d.pcdCanonical===fit.selectedId,'grade-raw',family);c.check(close(mark.tag==='circle'?num(mark,'cy'):num(mark,'y')+num(mark,'height')/2,grade===1?105:167),'grade-rung',family);
   const x=(family==='common'?0:width/2)+width/2*[.38,.78][d]+(expected.values[0][d]===expected.values[1][d]?(u===0?-12:12):0);c.check(close(mark.tag==='circle'?num(mark,'cx'):num(mark,'x')+num(mark,'width')/2,x),'grade-domain-coordinate',family);
  }
  c.check(eq(sorted(seen),['0:0','0:1','1:0','1:1']),'grade-identity',family);
  const cards=model.cards.filter(n=>n.d.pcdFamily===family);c.check(cards.every(n=>n.visible),'primary-mark-visible',family+' optima');optimizers(c,cards,fit.optimizerIds,fit.selectedId,family);cardDirections(c,cards,table);
 }
 return c.findings;
}

export function separabilityVisualFindings(model,fixture,reference){
 const c=checks(),svg=model.svgs[0],marks=role(model,'candidate'),rows=fixture.expected.fit.candidateTable,e=reference.expect;
 if(!svg)return[{code:'primary-svg'}];
 c.check(eq(sorted(marks.map(n=>n.d.mdvCandidate)),sorted(rows.map(r=>r.candidateId))),'lattice-nine-identities');
 for(const[key,expected]of [['Feasible',rows.filter(r=>r.feasible).map(r=>r.candidateId)],['Optimal',fixture.expected.fit.optimizerIds],['Canonical',[fixture.expected.fit.selectedId]],['Projected',e.projectionProductIds],['Missing',e.missingIds]])c.check(eq(sorted(marks.filter(n=>n.d[`mdv${key}`]==='true').map(n=>n.d.mdvCandidate)),sorted(expected)),`lattice-${key.toLowerCase()}`);
 const left=65,top=80,cw=(num(svg,'width')-80)/3,ch=64,actions=['1,1','1,2','2,1'];
 for(const mark of marks){const[col,row]=mark.d.mdvCandidate.slice(2).split('|').map(s=>actions.indexOf(s)),x=left+(col+.5)*cw,y=top+(row+.5)*ch,expected=rows.find(r=>r.candidateId===mark.d.mdvCandidate);const circles=svg.marks.filter(n=>n.tag==='circle'&&close(num(n,'cx'),x)&&close(num(n,'cy'),y)),circle=circles.find(n=>num(n,'r')===11);c.check(!!circle&&circle.a.opacity===(e.projectionProductIds.includes(mark.d.mdvCandidate)?'1':'0.4'),'lattice-node-geometry',mark.d.mdvCandidate);
  c.check(circles.some(n=>num(n,'r')===17)===expected.optimal&&circles.some(n=>num(n,'r')===20&&n.d.mdsOptimum===mark.d.mdvCandidate)===expected.optimal,'lattice-optimum-rings',mark.d.mdvCandidate);
  const cross=svg.marks.find(n=>n.tag==='path'&&n.a.d===`M${x-7},${y-7}L${x+7},${y+7}M${x+7},${y-7}L${x-7},${y+7}`);c.check(Boolean(cross)===!expected.feasible&&(!cross||num(cross,'stroke-width')===(e.missingIds.includes(mark.d.mdvCandidate)?3:1.5)),'lattice-exclusion-cross',mark.d.mdvCandidate);
  c.check(svg.marks.some(n=>n.d.mdsCanonical===mark.d.mdvCandidate&&n.a.d===`M${x},${y-5}l5,5l-5,5l-5,-5Z`)===(mark.d.mdvCandidate===fixture.expected.fit.selectedId),'lattice-canonical-diamond',mark.d.mdvCandidate);
 }
 const projection=role(model,'projection-product');c.check(projection.length===1,'projection-mark');
 if(projection[0]){const p=projection[0],cols=e.projectionColumns.map(a=>a.map(s=>actions.indexOf(s)));c.check(close(num(p,'x'),left+Math.min(...cols[0])*cw+3)&&close(num(p,'y'),top+Math.min(...cols[1])*ch+3)&&close(num(p,'width'),(Math.max(...cols[0])-Math.min(...cols[0])+1)*cw-6)&&close(num(p,'height'),(Math.max(...cols[1])-Math.min(...cols[1])+1)*ch-6),'projection-geometry');}
 for(const[d,domain]of ['S','C'].entries()){
  const bands=role(model,'weighted-minimum-band').filter(n=>n.d.mdvDomain===domain);c.check(eq(bands.map(n=>n.d.mdvColumn),e.weightedArgminColumns[d]),'weighted-minimum-set',domain);
  for(const band of bands){const i=actions.indexOf(band.d.mdvColumn);c.check(close(num(band,'x'),d===0?left+i*cw+5:left+5)&&close(num(band,'y'),d===0?top+5:top+i*ch+5)&&close(num(band,'width'),d===0?cw-10:3*cw-10)&&close(num(band,'height'),d===0?3*ch-10:ch-10),'weighted-minimum-geometry',domain);}
 }
 c.check(role(model,'separate-bound')[0]?.d.num===e.boundExact,'separate-bound');c.check(role(model,'feasible-minimum')[0]?.d.num===e.actualRiskExact,'feasible-minimum');
 const conclusion=e.factorizes?'recover every optimum':e.lowerBoundAttained?'bound is attained':'changes the optimum';c.check(model.summary.includes(conclusion),'separability-conclusion');
 return c.findings;
}

export function resolutionVisualFindings(model,law,budget){
 const c=checks(),svg=model.svgs[0];if(!svg)return[{code:'primary-svg'}];
  const left=40,span=num(svg,'width')-63,top=49,bottom=153,risks=role(model,'risk-point'),grades=role(model,'grade-count-point');
 c.check(svg.d.prrAlphaMax==='3/20'&&svg.d.prrRiskMax==='1/4'&&Number(svg.d.prrRiskTop)===top&&Number(svg.d.prrRiskBottom)===bottom&&Number(svg.d.prrAlphaLeft)===left&&close(Number(svg.d.prrAlphaWidth),span),'budget-risk-axis');
 c.check(risks.length===7&&grades.length===14,'budget-mark-count');
 for(const[d,domain]of ['S','C'].entries())for(const count of [1,2]){const y=d===0?(count===2?218:246):(count===2?286:314);c.check(svg.marks.some(n=>n.visible&&n.tag==='line'&&close(num(n,'x1'),left)&&close(num(n,'x2'),left+span)&&close(num(n,'y1'),y)&&close(num(n,'y2'),y))&&svg.marks.some(n=>n.visible&&n.tag==='text'&&n.d.num===String(count)&&close(num(n,'x'),left-8)&&close(num(n,'y'),y+5)),'grade-axis-geometry',domain+count);}
 for(let i=0;i<7;i++){
  const f=resolutionFixture(law,i),fit=f.expected.fit,row=fit.candidateTable.find(r=>r.candidateId===fit.selectedId),x=left+rationalValue(f.decision.alpha)/(3/20)*span;
  const points=risks.filter(n=>n.d.mdvBudgetIndex===String(i));c.check(points.length===1,'risk-budget-identity',i);
  for(const p of points){c.check(p.visible,'primary-mark-visible',`risk ${i}`);c.check(num(p,'r')>0,'risk-glyph-size',i);c.check(p.d.mdvExact===fit.riskExact&&p.d.mdvAlpha===f.decision.alpha,'risk-point-raw',i);c.check(close(num(p,'cx'),x)&&close(num(p,'cy'),bottom-rationalValue(fit.riskExact)/(1/4)*(bottom-top)),'risk-point-coordinate',i);c.check(p.d.mdvSelected===String(i===budget),'risk-selection',i);}
  for(const[d,domain]of ['S','C'].entries()){
   const gs=grades.filter(n=>n.d.mdvBudgetIndex===String(i)&&n.d.mdvDomain===domain);c.check(gs.length===1,'grade-count-identity',`${i}:${domain}`);
   for(const g of gs){const count=row.gradeCounts[d],y=d===0?(count===2?218:246):(count===2?286:314);c.check(g.visible,'primary-mark-visible',`${i}:${domain}`);if(d===0)c.check(num(g,'width')>0&&num(g,'height')>0,'grade-glyph-size',`${i}:${domain}`);c.check(g.d.mdvExact===String(count)&&g.d.mdvCanonical===fit.selectedId&&g.d.mdvAlpha===f.decision.alpha,'grade-count-raw',`${i}:${domain}`);c.check(d===0?close(num(g,'x')+5,x)&&close(num(g,'y')+5,y):g.a.d===`M${x},${y-6}l6,6l-6,6l-6,-6Z`,'grade-count-coordinate',`${i}:${domain}`);}
  }
  const tick=role(model,'budget-tick').filter(n=>n.d.mdvBudgetIndex===String(i));c.check(tick.length===1&&tick[0].d.num===f.decision.alpha&&close(num(tick[0],'x'),x),'budget-tick',i);
 }
 if(model.hasLayout){
  const ticks=role(model,'budget-tick').sort((a,b)=>Number(a.d.mdvBudgetIndex)-Number(b.d.mdvBudgetIndex));
  for(let i=1;i<ticks.length;i++)c.check(ticks[i].box.x-(ticks[i-1].box.x+ticks[i-1].box.width)>=1,'budget-tick-overlap',i);
 }
 const f=resolutionFixture(law,budget),fit=f.expected.fit,selection=role(model,'budget-selection');
 c.check(selection.length===1&&selection[0].d.mdvAlpha===f.decision.alpha&&close(num(selection[0],'x1'),left+rationalValue(f.decision.alpha)/(3/20)*span)&&close(num(selection[0],'x2'),num(selection[0],'x1')),'budget-selection-line');
 c.check(role(model,'selected-risk')[0]?.d.num===fit.riskExact,'selected-risk');c.check(model.scopeNumbers.includes(fit.jointProbabilityExact),'selected-joint-event');optimizers(c,model.cards,fit.optimizerIds,fit.selectedId,'resolution');cardDirections(c,model.cards,fit.candidateTable);
 return c.findings;
}

export function dependenceVisualFindings(model,fixture){
 const c=checks(),svg=model.svgs[0];if(!svg)return[{code:'primary-svg'}];
 const fixed=fixture.expected.fixedCards.find(r=>r.cardId==='p:1,2|1,2').evaluation;
 const overlap=fixture.input.masses[fixed.states.findIndex(s=>s.exceedances.every(Boolean))],offset=fixture.input.masses[fixed.states.findIndex(s=>s.exceedances[0]&&!s.exceedances[1])];
 const left=22,span=num(svg,'width')-44,scale=1/5;
 c.check(svg.d.mdpScaleMax==='1/5'&&Number(svg.d.mdpScaleLeft)===left&&close(Number(svg.d.mdpScaleWidth),span),'dependence-axis');
 for(const[key,raw,start]of [['marginal-S',fixed.domains[0].eventProbabilityExact,'0'],['marginal-C',fixed.domains[1].eventProbabilityExact,offset],['overlap',overlap,offset],['union',fixed.jointProbabilityExact,'0']]){
  const marks=role(model,key);c.check(marks.length===1,'dependence-mark-count',key);for(const mark of marks){c.check(mark.d.mdvExact===raw,'dependence-raw',key);c.check(close(num(mark,'x'),left+rationalValue(start)/scale*span)&&close(num(mark,'width'),rationalValue(raw)/scale*span),'dependence-geometry',key);}
 }
 const caps=role(model,'cap');c.check(caps.length===1,'dependence-cap-count');for(const cap of caps){c.check(cap.d.mdvExact===fixture.decision.alpha,'dependence-cap-raw');const x=left+rationalValue(fixture.decision.alpha)/scale*span;c.check(close(num(cap,'x1'),x)&&close(num(cap,'x2'),x)&&num(cap,'y2')>num(cap,'y1'),'dependence-cap-geometry');}
 c.check(eq(model.cards.map(n=>n.d.mdpOptimizer),fixture.expected.fit.optimizerIds),'dependence-optima');
 c.check(model.cards.every(n=>n.label===(n.d.mdpOptimizer===fixture.expected.fit.selectedId?'Canonical optimum':'Also optimal')),'dependence-canonical-labels');
 const stateKeys=['neither','S-only','C-only','both'];c.check(eq(model.scopeMasses.map(n=>n.d.mdpStateMass),stateKeys),'dependence-state-mass-set');
 for(const[index,key]of stateKeys.entries()){const expectedFlags=[[false,false],[true,false],[false,true],[true,true]][index],state=fixed.states.findIndex(s=>eq(s.exceedances,expectedFlags)),mass=model.scopeMasses.find(n=>n.d.mdpStateMass===key);c.check(mass?.raw===fixture.input.masses[state]&&mass?.visible,'dependence-state-mass',key);}
 return c.findings;
}

/** Enumerate pair directions independently from the saved original tuples. */
export function savedPayloadPairs(payload){
 const rows=payload.grade_tuples,out=[];
 for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){const directions=[1,2].map(d=>Math.sign(rows[b][d]-rows[a][d]));const classification=directions.every(d=>d===0)?'neither':directions[0]===0?'second_only':directions[1]===0?'first_only':directions[0]===directions[1]?'same_direction':'crossed';out.push({unitA:rows[a][0],unitB:rows[b][0],directions,classification});}
 return out;
}
export function fictionalVisualFindings(model,scenario,pair='S11|S18'){
 const c=checks(),svg=model.svgs[0],{reference:e,payload}=fictionalReference(scenario);if(!svg)return[{code:'primary-svg'}];
 const sites=role(model,'site'),cells=role(model,'profile-cell'),columns=Math.max(...e.cells.map(r=>r.columnGrade)),cellWidth=(num(svg,'width')-62)/columns,packing=Math.max(1,Math.floor((cellWidth-18)/20)),rowHeight=Math.max(77,Math.ceil(Math.max(...e.cells.map(c=>c.count))/packing)*20+25);
 c.check(eq(sites.map(n=>n.d.mdvUnit),e.grades.unitIds),'forty-site-ids');c.check(Number(svg.d.fspMapColumns)===Math.max(...e.cells.map(r=>r.columnGrade))&&Number(svg.d.fspMapRows)===Math.max(...e.cells.map(r=>r.rowGrade)),'map-dimensions');
 c.check(eq(cells.map(n=>n.d.mdvCell),e.cells.map(r=>`${r.rowGrade},${r.columnGrade}`)),'profile-cell-set');
 for(const cell of e.cells){const key=`${cell.rowGrade},${cell.columnGrade}`,mark=cells.find(n=>n.d.mdvCell===key);c.check(mark?.d.mdvCount===String(cell.count),'profile-cell-count',key);if(!mark)continue;c.check(mark.visible&&num(mark,'width')>0&&num(mark,'height')>0,'cell-glyph-geometry',key);c.check(close(num(mark,'x'),50+(cell.columnGrade-1)*cellWidth)&&close(num(mark,'y'),137+(cell.rowGrade-1)*rowHeight)&&close(num(mark,'width'),cellWidth-4)&&close(num(mark,'height'),rowHeight-4),'cell-ordinal-coordinate',key);
  const members=sites.filter(n=>n.d.mdvS===String(cell.columnGrade)&&n.d.mdvC===String(cell.rowGrade));c.check(eq(sorted(members.map(n=>n.d.mdvUnit)),sorted(cell.members)),'profile-cell-members',key);
  if(cell.count===0)c.check(svg.marks.some(n=>n.d.fspEmptyCell===key&&n.text==='Empty'),'true-empty-cell',key);
  for(const member of members){const dot=svg.marks.find(n=>n.d.fspSiteDot===member.d.mdvUnit);c.check(!!dot&&num(dot,'r')>0&&num(dot,'cx')>num(mark,'x')&&num(dot,'cx')<num(mark,'x')+num(mark,'width')&&num(dot,'cy')>num(mark,'y')&&num(dot,'cy')<num(mark,'y')+num(mark,'height'),'site-cell-geometry',member.d.mdvUnit);}
 }
 for(const site of sites){const row=payload.grade_tuples.find(r=>r[0]===site.d.mdvUnit);c.check(site.visible,'primary-mark-visible',site.d.mdvUnit);c.check(!!row&&site.d.mdvS===String(row[1])&&site.d.mdvC===String(row[2]),'original-site-tuple',site.d.mdvUnit);}
 const expected=savedPayloadPairs(payload).find(p=>`${p.unitA}|${p.unitB}`===pair),directions=role(model,'pair-direction');c.check(directions.length===2,'pair-direction-count');
 for(const[d,domain]of ['S','C'].entries()){
 const lines=directions.filter(n=>n.d.mdvDomain===domain);c.check(lines.length===1,'pair-domain-identity',domain);for(const line of lines){
  c.check(line.visible&&num(line,'x2')>num(line,'x1')&&num(line,'y1')===num(line,'y2'),'pair-line-geometry',domain);
  const direction=expected?.directions[d],index=svg.marks.indexOf(line),next=svg.marks[index+1];c.check(line.d.mdvDirection===String(direction)&&line.d.fspPair===pair,'pair-direction-raw',domain);
  if(direction===0)c.check(line.a['stroke-dasharray']==='3 4'&&next?.tag==='rect','pair-withheld-geometry',domain);
  else{const tip=direction>0?num(line,'x2'):num(line,'x1'),sign=direction>0?1:-1,y=num(line,'y1');c.check(next?.tag==='path'&&next.a.d===`M${tip-sign*8},${y-5}L${tip},${y}L${tip-sign*8},${y+5}`,'pair-arrow-geometry',domain);}
 }}
 return c.findings;
}

export function visualSurfaceFindings(model,{width=model.viewportWidth,closed=true}={}){
 const c=checks(),all=nodes(model),geometry=all.filter(n=>['rect','circle','line','path','polygon'].includes(n.tag));
 c.check(model.svgs.length>0&&geometry.length>=4,'meaningful-svg');
 c.check(all.filter(n=>n.d.mdvRole).every(n=>n.visible)&&model.cards.every(n=>n.visible),'primary-mark-visible');
 c.check(model.svgFonts.length>0&&model.svgFonts.every(f=>Number.isFinite(f)&&f>=14),'svg-font-floor');
 if(closed){c.check(model.visibleTables===0,'closed-data-tables');c.check(model.controls===1,'primary-control');c.check(model.disclosures.length===2&&model.disclosures.every(d=>d.tag==='details'&&d.summary==='summary'&&!d.open),'native-closed-disclosures');}
 if(model.hasLayout){
  c.check(model.overflow<=1,'page-overflow');c.check(model.stage.height>=(width===375?260:320),'primary-stage-height');c.check(model.summaryBox.bottom<=model.viewportHeight,'first-screen-result');
  const stage=Math.max(0,Math.min(model.stage.bottom,model.viewportHeight)-Math.max(0,model.stage.top)),widget=Math.max(1,Math.min(model.widget.bottom,model.viewportHeight)-Math.max(0,model.widget.top));c.check(stage/widget>=.55,'first-screen-stage-share');
  c.check(model.htmlFonts.length>0&&model.htmlFonts.every(f=>Number.isFinite(f)&&f>=14),'html-font-floor');
  c.check(geometry.some(n=>n.box.width>0&&n.box.height>0),'nonempty-svg-geometry');
  for(const card of model.cards){c.check(card.box.width>=112,'whole-tie-card-width',card.d.mdvReportId);c.check(card.scrollWidth<=card.clientWidth,'whole-tie-card-overflow',card.d.mdvReportId);}
 }
 return c.findings;
}
