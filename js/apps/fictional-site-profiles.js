// Author: JoonHo Lee (jlee296@ua.edu).
// Frozen fictional reports: tuple-derived inspection and faithful stored summaries only.
import {createWidget} from '../shared/base.js';
import {formatCount,formatGrades} from '../shared/format.js';
import {VISUAL_CSS,createVisualFrame,scene,svgNode,svgText,svgCount} from '../shared/mdomain/visual.js';
import {exactNum,gradeTable,profileGrid,profileCells,pairRows,pairTable,resultScopeNode,isCanonicalExact} from '../shared/mdomain/index.js';
import PRIMARY from '../../data/precomputed/v35/main-alpha-1_20.json' with {type:'json'};
import WIDE from '../../data/precomputed/v35/sensitivity-t-wide.json' with {type:'json'};
import MANIFEST from '../../data/precomputed/v35/manifest.json' with {type:'json'};

const DATA={primary:PRIMARY,wide:WIDE};
const IDS=PRIMARY.grade_tuples.map(row=>row[0]);
const PAIRS=IDS.flatMap((first,i)=>IDS.slice(i+1).map(second=>`${first}|${second}`));
const CELL_KEYS=['site','1,1','1,2','2,1','2,2','3,1','3,2'];
export const FICTIONAL_SITE_KEYS={scenario:{type:'choice',values:['primary','wide'],value:'primary'},site:{type:'choice',values:IDS,value:'S11'},pair:{type:'choice',values:PAIRS,value:'S11|S18'},cell:{type:'choice',values:CELL_KEYS,value:'site'}};
const cache=new Map();
function strictCutoff(threshold,N){
 if(!isCanonicalExact(threshold)||!Number.isSafeInteger(N)||N<0)throw new TypeError('A declared exact threshold and a nonnegative disclosure count are required.');
 const[n,d='1']=threshold.split('/');return Number(BigInt(n)*BigInt(N)/BigInt(d))+1;
}
const nullable=(record,key)=>Object.hasOwn(record,key)?record[key]:null;

/** No scientific fitting/evaluation is performed. Counts and cells derive only from grade tuples. */
export function inspectFictionalSiteProfiles(state={}){
 const scenario=state.scenario===undefined?'primary':state.scenario;let base=cache.get(scenario);
 if(!Object.hasOwn(DATA,scenario))throw new RangeError('Unknown stored fictional scenario.');
 if(!base){
  const payload=DATA[scenario],rows=payload.grade_tuples;
  if(payload.runtime_postrank_object!==false||rows.length!==IDS.length||rows.some((row,i)=>row[0]!==IDS[i]))throw new TypeError('The frozen display record must retain the original site order.');
  const grades={unitIds:[...IDS],domainIds:[...payload.domain_ids],values:rows.map(row=>row.slice(1))};
  const cells=profileCells(grades),pairs=pairRows(grades),pairClassCounts={neither:0,C_only:0,S_only:0,same:0,crossed:0};
  const classNames={neither:'neither',second_only:'C_only',first_only:'S_only',same_direction:'same',crossed:'crossed'};let N_S=0,N_C=0;
  for(const pair of pairs){pairClassCounts[classNames[pair.classification]]++;N_S+=Number(pair.directions[0]!==0);N_C+=Number(pair.directions[1]!==0);}
  const columnCount=Math.max(...cells.map(cell=>cell.columnGrade)),rowCount=Math.max(...cells.map(cell=>cell.rowGrade));
  const occupancy=Array.from({length:rowCount},(_,r)=>Array.from({length:columnCount},(_,c)=>cells.find(cell=>cell.rowGrade===r+1&&cell.columnGrade===c+1).count));
  const counts={originalPairs:pairs.length,N_S,N_C};
  const derived={occupancy_rows_C_columns_S:occupancy,pair_class_counts:pairClassCounts,unique_disclosed_pairs:pairs.length-pairClassCounts.neither,crossed_pairs:pairClassCounts.crossed,occupied_cells:cells.filter(cell=>cell.count>0).length,total_cells:cells.length};
  const denominators=payload.domain_ids.map((domainId,d)=>{const N=d===0?N_S:N_C;return {domainId,N,ratioStatus:N===0?'no_disclosure':'not_stored',cutoff:strictCutoff(payload.design.t,N),eventActive:N>0};});
  const roleRows=['selection','diagnostic'].map(role=>({role,chainIds:[...payload.state_roles[`${role}_chain_ids`]],stateCount:payload.state_roles.states_per_role,storedRiskExact:role==='selection'?payload.results.risk_exact:nullable(payload.results,'diagnostic_risk_exact'),storedJExact:payload.results[`${role}_J_exact`],storedUnionHits:payload.results[`${role}_union_hits`],storedAnyErrorHits:nullable(payload.results,`${role}_any_error_hits`)}));
  base={payload,grades,cells,pairs,counts,derived,denominators,roleRows};cache.set(scenario,base);
 }
 const site=state.site===undefined?'S11':state.site,pair=state.pair===undefined?'S11|S18':state.pair,cell=state.cell===undefined?'site':state.cell;
 const siteIndex=IDS.indexOf(site);if(siteIndex<0||!PAIRS.includes(pair)||!CELL_KEYS.includes(cell))throw new RangeError('Inspection keys must identify public sites, pairs and cells.');
 const selectedSite={unitId:site,values:[...base.grades.values[siteIndex]]},[unitA,unitB]=pair.split('|');
 const selectedPair=base.pairs.find(p=>p.unitA===unitA&&p.unitB===unitB);
 const selectedCell=cell==='site'?base.cells.find(c=>c.rowGrade===selectedSite.values[1]&&c.columnGrade===selectedSite.values[0]):base.cells.find(c=>`${c.rowGrade},${c.columnGrade}`===cell)??null;
 return {...base,selectedSite,selectedPair,selectedCell,cellMode:cell==='site'?'site':'manual'};
}
const CSS=`${VISUAL_CSS}
.fsp select{min-height:44px}.fsp .fsp-map-point{cursor:pointer;outline:none}.fsp .fsp-map-point:focus .fsp-map-hit,.fsp .fsp-map-cell:focus{stroke:var(--prx-plot-focus);stroke-width:3}.fsp .fsp-map-cell{cursor:pointer;outline:none}.fsp .fsp-map-cell:focus-visible{outline:3px solid var(--prx-plot-focus);outline-offset:2px}.fsp .fsp-map-note{padding:.35rem .85rem .6rem;font-size:.88rem;color:var(--prx-plot-fg);line-height:1.4}
.fsp{min-width:0}.fsp .fsp-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,25rem),1fr));gap:1rem;min-width:0}.fsp .fsp-section{min-width:0;margin:.8rem 0}.fsp .fsp-note{font-size:.88rem;line-height:1.45}.fsp .fsp-scroll{overflow-x:auto;max-width:100%;min-width:0}
.fsp .fsp-table{width:max-content;min-width:100%;max-width:none;border-collapse:collapse;font-size:.88rem}.fsp .fsp-table th,.fsp .fsp-table td{padding:.4rem;text-align:left;white-space:nowrap;border-bottom:1px solid var(--prx-border)}
.fsp tr[data-fsp-selected-site=true]{outline:2px solid var(--prx-accent);outline-offset:-2px}.fsp tr[data-fsp-cell-member=true]{background:var(--prx-plot-bg)}.fsp .fsp-source{overflow-wrap:anywhere}.fsp .fsp-status{font-weight:600}.fsp [data-prx-readout=site-id]{font-weight:600}
`;
function count(ctx,value,hook){const n=ctx.num(value,formatCount(value));if(hook)n.dataset.prxReadout=hook;return n;}
function exact(ctx,value,hook,options={}){const n=exactNum(ctx,value,options);if(hook)n.dataset.prxReadout=hook;return n;}
function named(ctx,value,hook){const n=ctx.h('span',{'data-prx-name':''},String(value));if(hook)n.dataset.prxReadout=hook;return n;}
function section(ctx,title){return ctx.h('section',{class:'fsp-section'},ctx.panelTitle(title));}
function table(ctx,heads,rows,caption){const t=ctx.h('table',{class:'fsp-table'},ctx.h('caption',{},caption),ctx.h('thead',{},ctx.h('tr',{},heads.map(h=>ctx.h('th',{scope:'col'},h)))),ctx.h('tbody',{},rows.map(row=>ctx.h('tr',{},row.map((cell,i)=>ctx.h(i?'td':'th',i?{}:{scope:'row'},cell))))));return ctx.scrollRegion(ctx.h('div',{class:'fsp-scroll'},t),caption);}
const PAIR_DESCRIPTIONS={neither:'Directions withheld in both domains',first_only:'Only the S direction is disclosed',second_only:'Only the C direction is disclosed',same_direction:'Strict directions agree across domains',crossed:'Strict directions cross across domains'};
function pairKey(a,b){if(a===b)return null;return IDS.indexOf(a)<IDS.indexOf(b)?`${a}|${b}`:`${b}|${a}`;}

// Display coordinates arrange original tuples inside ordinal cells; no spatial distance or total rank is implied.
function drawProfileMap(ctx,visual,result,state){
 const columns=Math.max(...result.cells.map(c=>c.columnGrade)),rows=Math.max(...result.cells.map(c=>c.rowGrade));
 const physicalWidth=Math.max(280,Math.round(visual.stage.getBoundingClientRect?.().width||ctx.width?.()||640));
 const left=48,right=14,top=135,cellWidth=(physicalWidth-left-right)/columns;
 const packingColumns=Math.max(1,Math.floor((cellWidth-18)/20));
 const rowHeight=Math.max(77,Math.ceil(Math.max(...result.cells.map(c=>c.count))/packingColumns)*20+25);
 const height=top+rows*rowHeight+28;
 const {svg,figure,width,colors}=scene(ctx,visual.stage,{height,label:'Saved fictional site profiles: composition grades in columns, community grades in rows, one point per original site and directions for the inspected pair.'});
 svg.setAttribute('role','group');svg.setAttribute('data-fsp-map-columns',String(columns));svg.setAttribute('data-fsp-map-rows',String(rows));
 figure.insertBefore(ctx.h('figcaption',{},'S site composition · C community. Each dot is a site. Square and diamond mark the inspected pair.'),svg);
 const selected=result.selectedPair,ids=[selected.unitA,selected.unitB];
 svg.append(svgText(ctx,width/2,19,'Inspected pair',{'font-size':15,'text-anchor':'middle','font-weight':600}));
 const pairLeft=Math.max(90,width*.32),pairRight=width-47;
 for(let d=0;d<2;d++){
  const y=45+d*31,direction=selected.directions[d],first=direction>=0?pairLeft:pairRight,last=direction>=0?pairRight:pairLeft;
  svg.append(svgText(ctx,19,y+5,result.grades.domainIds[d],{'font-size':16,'font-weight':600}));
  svg.append(svgText(ctx,pairLeft-9,y+5,ids[0],{'font-size':15,'text-anchor':'end','data-prx-name':''}),svgText(ctx,pairRight+9,y+5,ids[1],{'font-size':15,'data-prx-name':''}));
  const line=svgNode(ctx,'line',{x1:pairLeft,y1:y,x2:pairRight,y2:y,stroke:colors.plotFg,'stroke-width':2,'stroke-dasharray':direction===0?'3 4':undefined,'data-mdv-role':'pair-direction','data-mdv-domain':result.grades.domainIds[d],'data-mdv-direction':String(direction),'data-fsp-pair':state.pair});
  svg.append(line);
  if(direction!==0){
   const sign=Math.sign(last-first),above=direction>0?ids:ids.toReversed();
   svg.append(svgNode(ctx,'path',{d:`M${last-sign*8},${y-5}L${last},${y}L${last-sign*8},${y+5}`,fill:'none',stroke:colors.plotFg,'stroke-width':2}));
   svg.append(svgText(ctx,(pairLeft+pairRight)/2,y+5,`${above[0]} above ${above[1]}`,{'font-size':15,'text-anchor':'middle','data-prx-name':'','paint-order':'stroke',stroke:colors.plotBg,'stroke-width':7,'stroke-linejoin':'round'}));
  }
  else{svg.append(svgNode(ctx,'rect',{x:(pairLeft+pairRight)/2-40,y:y-10,width:80,height:20,fill:colors.plotBg}),svgText(ctx,(pairLeft+pairRight)/2,y+5,'Withheld',{'font-size':15,'text-anchor':'middle'}));}
 }
 svg.append(svgText(ctx,(left+width-right)/2,111,'S grade →',{'font-size':15,'text-anchor':'middle','font-weight':600}),svgText(ctx,4,top+9,'C ↓',{'font-size':15,'font-weight':600}));
 for(let c=1;c<=columns;c++)svg.append(svgCount(ctx,left+(c-.5)*cellWidth,130,c,{'font-size':15,'text-anchor':'middle'}));
 for(let r=1;r<=rows;r++)svg.append(svgCount(ctx,25,top+(r-.5)*rowHeight+5,r,{'font-size':15,'text-anchor':'middle'}));
 const pointGroups=[];
 for(const cell of result.cells){
  const x=left+(cell.columnGrade-1)*cellWidth,y=top+(cell.rowGrade-1)*rowHeight,key=`${cell.rowGrade},${cell.columnGrade}`,isSelected=result.selectedCell?.rowGrade===cell.rowGrade&&result.selectedCell?.columnGrade===cell.columnGrade;
  const rect=svgNode(ctx,'rect',{class:'fsp-map-cell',x:x+2,y:y+2,width:cellWidth-4,height:rowHeight-4,rx:5,fill:colors.plotBg,stroke:isSelected?colors.plotFg:colors.plotGrid,'stroke-width':isSelected?2.5:1,'stroke-dasharray':isSelected?'4 3':undefined,role:'button',tabindex:isSelected||(!result.selectedCell&&key==='1,1')?0:-1,'aria-label':`C grade ${cell.rowGrade}, S grade ${cell.columnGrade}; ${cell.count} sites.${isSelected?' Inspected cell.':''}`,'aria-pressed':String(isSelected),'data-mdv-role':'profile-cell','data-mdv-cell':key,'data-mdv-count':String(cell.count),'data-prx-focus-key':`profile-map-cell:${key}`});
  const choose=()=>ctx.set({cell:key});rect.addEventListener('click',choose);rect.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();return;}
   const shift={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]}[event.key];if(!shift)return;event.preventDefault();
   const rr=(cell.rowGrade-1+shift[0]+rows)%rows+1,cc=(cell.columnGrade-1+shift[1]+columns)%columns+1,next=`${rr},${cc}`;ctx.set({cell:next});visual.stage.querySelector(`[data-mdv-cell="${next}"]`)?.focus?.();
  });svg.append(rect);
  if(cell.count===0)svg.append(svgText(ctx,x+cellWidth/2,y+rowHeight/2+5,'Empty',{'font-size':15,'text-anchor':'middle','data-fsp-empty-cell':key,'pointer-events':'none'}));
  const spacing=Math.min(20,(cellWidth-18)/packingColumns),used=Math.min(packingColumns,cell.members.length),start=x+(cellWidth-(Math.max(1,used)-1)*spacing)/2;
  for(let i=0;i<cell.members.length;i++){
   const id=cell.members[i],px=start+(i%packingColumns)*spacing,py=y+20+Math.floor(i/packingColumns)*20,active=id===state.site,pairIndex=ids.indexOf(id),index=result.grades.unitIds.indexOf(id),grades=result.grades.values[index];
   const group=svgNode(ctx,'g',{class:'fsp-map-point',role:'button',tabindex:active?0:-1,'aria-label':`${id}; S grade ${grades[0]}, C grade ${grades[1]}.${active?' Highlighted site.':''}${pairIndex>=0?' Member of inspected pair.':''}`,'aria-pressed':String(active),'data-mdv-role':'site','data-mdv-unit':id,'data-mdv-s':String(grades[0]),'data-mdv-c':String(grades[1]),'data-mdv-site-selected':String(active),'data-mdv-pair-member':String(pairIndex>=0),'data-prx-focus-key':`profile-map-site:${id}`});
   group.append(svgNode(ctx,'rect',{class:'fsp-map-hit','data-prx-focus-ring':'',x:px-9,y:py-9,width:18,height:18,rx:3,fill:'transparent',stroke:'transparent'}));
   if(active)group.append(svgNode(ctx,'circle',{cx:px,cy:py,r:8.3,fill:'none',stroke:colors.plotFg,'stroke-width':1.5,'data-fsp-highlight':id}));
   group.append(svgNode(ctx,'circle',{cx:px,cy:py,r:5.1,fill:active?colors.accent:colors.plotFg,'data-fsp-site-dot':id}));
   if(pairIndex===0)group.append(svgNode(ctx,'rect',{x:px-6.5,y:py-6.5,width:13,height:13,fill:'none',stroke:colors.crit[0],'stroke-width':1.7}));
   if(pairIndex===1)group.append(svgNode(ctx,'path',{d:`M${px},${py-8}l8,8l-8,8l-8,-8Z`,fill:'none',stroke:colors.crit[1],'stroke-width':1.7}));
   group.append(svgNode(ctx,'title',{},`${id}: S grade ${grades[0]}, C grade ${grades[1]}.`));
   const inspect=()=>ctx.set({site:id,cell:'site'});group.addEventListener('click',inspect);group.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect();return;}
    const shift={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];if(shift===undefined&&event.key!=='Home'&&event.key!=='End')return;event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?IDS.length-1:(index+shift+IDS.length)%IDS.length;ctx.set({site:IDS[next],cell:'site'});visual.stage.querySelector(`[data-mdv-unit="${IDS[next]}"]`)?.focus?.();
   });pointGroups.push({id,group});
  }
 }
 for(const {group}of pointGroups.sort((a,b)=>IDS.indexOf(a.id)-IDS.indexOf(b.id)))svg.append(group);
 svg.append(svgText(ctx,width/2,height-6,'First grade = higher domain priority',{'font-size':15,'text-anchor':'middle'}));
 const inspector=ctx.h('div',{class:'fsp-map-note','data-fsp-map-inspector':'','role':'group','aria-label':'Highlighted site and inspected cell'},'Highlighted site ',named(ctx,result.selectedSite.unitId),' · S ',count(ctx,result.selectedSite.values[0]),' · C ',count(ctx,result.selectedSite.values[1]),'. ',result.cellMode==='manual'?'Cell inspected separately. ':'Cell follows highlighted site. ',result.selectedCell?ctx.h('span',{},count(ctx,result.selectedCell.count),' in cell.'):'Cell absent in this card.');figure.append(inspector);
}

export function mountWidget(el,spec={}){
 return createWidget(el,spec,{name:'fictional-site-profiles',className:'fsp',css:CSS,keys:FICTIONAL_SITE_KEYS,
 build(ctx){
  const scenario=ctx.select({label:'Saved scenario',options:[{value:'primary',label:'Primary saved card'},{value:'wide',label:'Wider-threshold saved card'}],value:'primary',onChange:v=>ctx.set({scenario:v,cell:'site'})});
  const site=ctx.select({label:'Highlighted site (separate from the inspected pair)',options:IDS.map(value=>({value,label:value})),value:'S11',onChange:v=>ctx.set({site:v,cell:'site'})});
  let first,second;
  function choosePair(which,value){const old=ctx.state.pair.split('|'),updated=[...old];updated[which]=value;const key=pairKey(...updated);if(key)ctx.set({pair:key});else{first.set(old[0]);second.set(old[1]);}}
  first=ctx.select({label:'First site in pair (original ID order)',options:IDS.map(value=>({value,label:value})),value:'S11',onChange:v=>choosePair(0,v)});
  second=ctx.select({label:'Second site in pair (original ID order)',options:IDS.map(value=>({value,label:value})),value:'S18',onChange:v=>choosePair(1,v)});
  const cell=ctx.select({label:'Inspected profile cell',options:CELL_KEYS.map(value=>({value,label:value==='site'?'Follow highlighted site':`C ${['first','second','third'][Number(value.split(',')[0])-1]}; S ${['first','second','third'][Number(value.split(',')[1])-1]}`})),value:'site',onChange:v=>ctx.set({cell:v})});
  ctx.controls.append(scenario.root,site.root,first.root,second.root,cell.root);ctx.charts.before(ctx.readout.node);
  const scope=ctx.h('div'),policy=ctx.h('p',{class:'fsp-note'});ctx.charts.append(scope,policy);
  const grid=section(ctx,'Profile cells and highlighted site'),pair=section(ctx,'A pair of sites'),sites=section(ctx,'Every site in its original order'),stored=section(ctx,'Stored selection and diagnostic summaries'),sourceDetails=section(ctx,'Source, target identities and conditioning');
  ctx.charts.append(ctx.h('div',{class:'fsp-layout'},grid,pair),sites,stored,sourceDetails);
  const visual=createVisualFrame(ctx,{mainControl:scenario.root,firstPreset:'crossed'});
  return {render(state){
   visual.sync();
   const r=inspectFictionalSiteProfiles(state),{payload,counts,derived,selectedSite,selectedPair,selectedCell}=r;
   scenario.set(state.scenario);site.set(state.site);const pairIds=state.pair.split('|');first.set(pairIds[0]);second.set(pairIds[1]);cell.set(state.cell);
   for(const option of first.root.querySelectorAll('option'))option.disabled=IDS[Number(option.value)]===pairIds[1];for(const option of second.root.querySelectorAll('option'))option.disabled=IDS[Number(option.value)]===pairIds[0];
   const presentCells=new Set(r.cells.map(c=>`${c.rowGrade},${c.columnGrade}`));for(const option of cell.root.querySelectorAll('option'))option.disabled=CELL_KEYS[Number(option.value)]!=='site'&&!presentCells.has(CELL_KEYS[Number(option.value)]);
   scope.replaceChildren(resultScopeNode(ctx,payload,{kind:'stored'}));
   policy.replaceChildren('Stored policy: equal domain weights ',exact(ctx,payload.design.weights[0],'weight-0'),' and ',exact(ctx,payload.design.weights[1],'weight-1'),'; withholding cost ',exact(ctx,payload.design.tau,'tau'),'; expected-error cap ',exact(ctx,payload.design.q,'q'),'; strict event threshold ',exact(ctx,payload.design.t,'threshold'),'; inclusive joint cap ',exact(ctx,payload.design.alpha,'alpha'),'. These were the settings used to select the saved grades. The controls let you examine those grades.');
   visual.auditReadout.set([count(ctx,r.grades.unitIds.length,'unit-count'),' fictional sites form ',count(ctx,derived.occupied_cells,'occupied-cells'),' occupied cells out of ',count(ctx,derived.total_cells,'total-cells'),'. S discloses ',count(ctx,counts.N_S,'N-S'),' pairs and C discloses ',count(ctx,counts.N_C,'N-C'),'; ',count(ctx,derived.unique_disclosed_pairs,'unique-pairs'),' of ',count(ctx,counts.originalPairs,'original-pairs'),' original pairs have at least one disclosed direction, including ',count(ctx,derived.crossed_pairs,'crossed-pairs'),' with crossed directions.']);
   grid.replaceChildren(ctx.panelTitle('Profile cells and highlighted site'),ctx.h('p',{},'Highlighted site ',named(ctx,selectedSite.unitId,'site-id'),': S grade ',count(ctx,selectedSite.values[0],'site-S'),', C grade ',count(ctx,selectedSite.values[1],'site-C'),'. The grid has C rows and S columns. Grade ',count(ctx,Math.min(...r.grades.values.flat())),' is highest within each domain.'));
   const gridNode=profileGrid(ctx,r.grades,{selectedUnit:state.cell==='site'?state.site:null,onSelectCell:c=>ctx.set({cell:`${c.rowGrade},${c.columnGrade}`}),caption:'C rows and S columns; empty cells are retained'});
   const buttons=[...gridNode.querySelectorAll('[data-prx-profile-grid-cell]')];for(const button of buttons){const td=button.closest('[data-prx-mdomain-cell]'),pressed=selectedCell&&td.dataset.prxMdomainCell===`${selectedCell.rowGrade},${selectedCell.columnGrade}`;button.setAttribute('aria-pressed',pressed?'true':'false');button.classList.toggle('prx-btn-primary',Boolean(pressed));button.tabIndex=pressed?0:-1;}if(!buttons.some(b=>b.tabIndex===0)&&buttons[0])buttons[0].tabIndex=0;grid.append(gridNode);
   if(selectedCell)grid.append(ctx.h('p',{},r.cellMode==='site'?'The inspected cell follows the highlighted site: ':'The inspected cell is independent of the highlighted site: ','C grade ',count(ctx,selectedCell.rowGrade,'cell-C'),', S grade ',count(ctx,selectedCell.columnGrade,'cell-S'),', with ',count(ctx,selectedCell.count,'cell-count'),(selectedCell.count===1?' member. ':' members. '),named(ctx,selectedCell.members.join(', ')||'No sites.','cell-members')));else grid.append(ctx.h('p',{'data-prx-readout':'cell-status'},'Not present in this saved card. Choose an available cell or follow the highlighted site.'));
   grid.append(ctx.h('p',{class:'fsp-note'},'The grid marks the selected cell. The site table outlines the highlighted site. A shared grade leaves the comparison unstated. Use the arrow keys to move between cells and Enter to select one.'));
   pair.replaceChildren(ctx.panelTitle('A pair of sites'),ctx.h('p',{},named(ctx,selectedPair.unitA,'pair-A'),' and ',named(ctx,selectedPair.unitB,'pair-B'),': ',ctx.h('strong',{'data-prx-readout':'pair-class'},PAIR_DESCRIPTIONS[selectedPair.classification]),'.'),pairTable(ctx,r.grades,{units:pairIds,caption:'Reported directions for the inspected pair'}));
   const pairGrades=pairIds.map((id,i)=>{const values=r.grades.values[r.grades.unitIds.indexOf(id)];return[named(ctx,id),count(ctx,values[0],`pair-${i}-S`),count(ctx,values[1],`pair-${i}-C`)];});pair.append(table(ctx,['Site','S grade','C grade'],pairGrades,'Original grades of the inspected pair'));
   pair.append(table(ctx,['Pair class','Count among all original pairs'],[['Both directions withheld',count(ctx,derived.pair_class_counts.neither,'class-neither')],['C only',count(ctx,derived.pair_class_counts.C_only,'class-C-only')],['S only',count(ctx,derived.pair_class_counts.S_only,'class-S-only')],['Same strict direction in both',count(ctx,derived.pair_class_counts.same,'class-same')],['Crossed strict directions',count(ctx,derived.pair_class_counts.crossed,'class-crossed')]],'Tuple-derived unordered pair classes'));
   pair.append(ctx.h('p',{class:'fsp-note'},'“Same strict direction” means both domains state the same direction for a pair. If both grades tie, both directions are withheld. The total counts a pair once if either domain states it.'));
   const siteTable=gradeTable(ctx,r.grades,{selectedUnit:state.site,onSelectUnit:unit=>ctx.set({site:unit,cell:'site'}),caption:'All fictional sites; original identifiers and order are retained'});for(const row of siteTable.querySelectorAll('[data-prx-mdomain-unit]')){row.dataset.fspSelectedSite=row.dataset.prxMdomainUnit===state.site?'true':'false';row.dataset.fspCellMember=selectedCell?.members.includes(row.dataset.prxMdomainUnit)?'true':'false';}sites.replaceChildren(ctx.panelTitle('Every site in its original order'),ctx.h('p',{class:'fsp-note'},'Shading marks the sites in the selected cell, and the outline marks the highlighted site. The rows follow the original site order.'),siteTable);
   const roleRows=r.roleRows.map(row=>[named(ctx,row.role),named(ctx,row.chainIds.join(', ')),count(ctx,row.stateCount,`${row.role}-states`),row.storedRiskExact===null?named(ctx,'Not stored',`${row.role}-risk-status`):exact(ctx,row.storedRiskExact,`${row.role}-risk`,{style:'decimal',digits:6,title:`Exact represented value: ${row.storedRiskExact}`}),exact(ctx,row.storedJExact,`${row.role}-J`,{style:'decimal',digits:6,title:`Exact represented value: ${row.storedJExact}`}),count(ctx,row.storedUnionHits,`${row.role}-union-hits`),row.storedAnyErrorHits===null?named(ctx,'Not stored',`${row.role}-any-error-status`):count(ctx,row.storedAnyErrorHits,`${row.role}-any-error-hits`)]);
   stored.replaceChildren(ctx.panelTitle('Stored selection and diagnostic summaries'),ctx.h('p',{class:'fsp-note'},'The risk and error summaries come from the original analyses. The selection and diagnostic chains served separate purposes. The split alone provides no evidence of independence.'),table(ctx,['Stored role','Chain IDs','States in role','Stored risk','Stored joint fraction','Stored threshold-union hits','Stored any-error hits'],roleRows,'Stored summaries with separate state roles'));
   const domainRows=r.denominators.map((d,i)=>[named(ctx,d.domainId),count(ctx,d.N,`domain-${i}-N`),d.ratioStatus==='no_disclosure'?exact(ctx,null,`domain-${i}-ratio`):named(ctx,'Not stored',`domain-${i}-ratio-status`),count(ctx,d.cutoff,`domain-${i}-cutoff`),d.eventActive?'Active when the false count reaches the cutoff':'Inactive: no disclosure']);
   stored.append(table(ctx,['Domain','Disclosed pairs','Expected false / disclosed','First count above threshold','Event definition'],domainRows,'Tuple-derived denominators and exact declared cutoff definitions'),ctx.h('p',{class:'fsp-note'},'A joint-event fraction of zero means that none of the states exceeded the error-share threshold. Some states can still contain errors. The original output does not give expected error shares for domains with stated comparisons.'));
   if(state.scenario==='primary')stored.append(ctx.h('p',{},'For the C threshold, ',exact(ctx,payload.design.t),' of ',count(ctx,counts.N_C),' disclosed pairs equals ',count(ctx,r.denominators[1].cutoff-1),'; the first strict exceedance count is ',count(ctx,r.denominators[1].cutoff),'. Equality does not exceed the threshold.'));
   const attribution=payload.attribution,details=ctx.h('details',{},ctx.h('summary',{},'Stored target identities, sample conditioning and source identifiers'),ctx.h('p',{},'S target: ',payload.targets.S),ctx.h('p',{},'C target: ',payload.targets.C),ctx.h('p',{},'Declared target-identity classes: S ',count(ctx,payload.targets.S_identity_classes),'; C ',count(ctx,payload.targets.C_identity_classes),'. C identity pairs: ',named(ctx,payload.targets.C_identity_pairs.map(p=>p.join('/')).join('; ')),'. Grade groups do not count geographic catchments.'),ctx.h('p',{},'Original retained iteration indices ',count(ctx,payload.source_identity.original_iterations[0]),' through ',count(ctx,payload.source_identity.original_iterations[1]),'; ',count(ctx,payload.source_identity.original_dimensions.chains),' original chains. The saved report used ',count(ctx,payload.design.candidate_product),' declared candidate combinations, with ',count(ctx,payload.results.feasible_candidates),' stored feasible candidates and ',count(ctx,payload.results.optimizer_count),' stored optima.'),ctx.h('p',{class:'fsp-source'},'Original source commit: ',named(ctx,payload.source_identity.repository_commit),'. Source-content hash: ',named(ctx,payload.source_identity.sha256),'. Bundled display-asset hash: ',named(ctx,MANIFEST.bundled_asset_sha256),'.'));
   sourceDetails.replaceChildren(ctx.panelTitle('Source, target identities and conditioning'),ctx.h('p',{},'These estimates summarize the states used in the original analyses. Feasibility under the intended posterior and independent validation would require separate evidence.'),details,ctx.h('p',{class:'fsp-source'},named(ctx,attribution.copyright),'. ',attribution.title,'. Content: ',ctx.h('a',{href:attribution.license_url,target:'_blank',rel:'noopener','data-prx-label':'license'},attribution.content_license),'. ',ctx.h('a',{href:attribution.source_url,target:'_blank',rel:'noopener'},'Original tutorial and source'),'. ',attribution.original_code_license,' ',attribution.changes));
   drawProfileMap(ctx,visual,r,state);
   ctx.readout.set([named(ctx,selectedPair.unitA),' and ',named(ctx,selectedPair.unitB),' · ',PAIR_DESCRIPTIONS[selectedPair.classification],'.']);
   visual.setScope(['Saved fictional report · ',named(ctx,'JoonHo Lee'),' · ',ctx.h('a',{href:payload.attribution.license_url,target:'_blank',rel:'noopener'},'CC BY'),'. No refit or posterior certificate. No overall site order; packing within cells has no distance meaning.']);
  }};
 }});
}
