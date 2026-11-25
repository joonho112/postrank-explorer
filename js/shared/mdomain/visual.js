// Author: JoonHo Lee (jlee296@ua.edu).
// Presentation only. Exact results come from the supplied scientific adapter.
import {exactNum,formatExactText} from './format.js';
import {formatCount} from '../format.js';
import {palette} from '../chart.js';
const NS='http://www.w3.org/2000/svg';

export const VISUAL_CSS=`
.mdv{min-width:0}.mdv .mdv-stage{min-width:0;color-scheme:light;background:var(--prx-plot-bg);color:var(--prx-plot-fg);border:1px solid var(--prx-border);border-radius:12px;overflow:hidden}
.mdv .mdv-figure{margin:0;min-width:0}.mdv .mdv-figure>svg{display:block;width:100%;height:auto;overflow:visible}
.mdv .mdv-stage .mdv-figure figcaption{padding:.5rem .85rem;margin:0;font-size:.88rem;color:var(--prx-plot-muted)}
.mdv .mdv-scope{margin:.35rem 0 .75rem;font-size:max(14px,.82rem);color:var(--prx-fg-muted)}
.mdv .prx-readout{margin:.1rem 0 .28rem;padding:.05rem 0;border:0;background:none;font-size:1rem;line-height:1.4;box-shadow:none}
.mdv>.prx-controls{margin-bottom:.1rem}
.mdv .mdv-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .5rem;margin-bottom:.15rem;min-width:0}
.mdv .mdv-toolbar>.prx-presets{flex:1 1 0;min-width:0;flex-direction:row;align-items:center;gap:.35rem}
.mdv .mdv-toolbar .prx-seg-label{flex:none;white-space:nowrap}
.mdv .mdv-toolbar .prx-seg-buttons{flex:1 1 auto;min-width:0;display:flex;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;gap:.25rem;padding:1px}
.mdv .mdv-toolbar .prx-seg{flex:none;white-space:nowrap}
@media(min-width:601px){.mdv .mdv-toolbar .prx-seg-buttons{flex-wrap:wrap;overflow-x:visible}.mdv .mdv-toolbar .prx-seg{padding:.18rem .45rem;font-size:.8125rem}}
.mdv .mdv-toolbar>.mdv-details>summary{min-height:34px;padding:.2rem 0}
.mdv .mdv-toolbar>.mdv-details[open]{flex:1 0 100%}
.mdv .mdv-disclosures{display:grid;gap:.55rem;margin:.7rem 0}.mdv .mdv-details{margin:0;min-width:0;border:1px solid var(--prx-border);border-radius:7px;padding:0 .8rem;background:var(--prx-bg)}
.mdv .mdv-details>summary{cursor:pointer;min-height:44px;display:list-item;align-content:center;font-weight:600;padding:.5rem 0;line-height:1.25}
.mdv .mdv-details-body{min-width:0;padding:.4rem 0 .8rem}
.mdv .mdv-settings{display:flex;flex-wrap:wrap;gap:.75rem;align-items:end}
.mdv .prx-control{min-width:0;max-width:100%}.mdv select{max-width:100%}
.mdv .mdv-audit-summary{font-size:.9rem;line-height:1.5;margin:.3rem 0 .7rem}
.mdv .mdv-figure button,.mdv .mdv-figure [role=button]{cursor:pointer}.mdv .mdv-inspector{padding:.5rem .85rem;font-size:.9rem;min-height:2.5rem;line-height:1.4;color:inherit}
.mdv .mdv-optima{display:flex;flex-wrap:wrap;gap:.6rem;padding:.5rem .75rem .8rem;justify-content:center}
.mdv .mdv-report-button{border:2px solid var(--prx-plot-fg);border-style:double;border-width:3px;border-radius:8px;background:var(--prx-plot-bg);color:var(--prx-plot-fg);min-width:132px;max-width:100%;padding:.4rem .6rem;min-height:44px;text-align:left;font:inherit}
.mdv .mdv-report-button[aria-pressed=true]{outline:3px solid var(--prx-focus);outline-offset:2px}.mdv .mdv-report-line{display:block;font-size:.9rem;white-space:nowrap;line-height:1.6}.mdv .mdv-report-label{display:block;font-size:14px;font-weight:600;margin-bottom:.1rem}
.mdv .mdv-legend{display:flex;gap:.5rem 1rem;flex-wrap:wrap;padding:.4rem .85rem;font-size:.82rem;color:inherit}
.mdv .mdv-legend span{display:inline-flex;gap:.35rem;align-items:center}.mdv .mdv-swatch{display:inline-block;width:1rem;height:.6rem;border:1px solid currentColor}
@media(max-width:600px){
 .mdv .prx-controls{gap:.35rem}.mdv>.prx-controls{margin-bottom:.1rem}
 .mdv>.prx-controls>.prx-control:not(.prx-slider):not(.prx-toggle){display:flex;align-items:center;gap:.45rem;flex:1 1 100%}
 .mdv>.prx-controls>.prx-control:not(.prx-slider):not(.prx-toggle)>label{margin:0;white-space:nowrap}
 .mdv>.prx-controls>.prx-control:not(.prx-slider):not(.prx-toggle)>select{flex:1 1 auto;min-width:0}
 .mdv .prx-readout{margin:.12rem 0 .2rem}
 .mdv .mdv-toolbar{gap:3px;margin-bottom:.2rem}
 .mdv .mdv-toolbar>.prx-presets,.mdv .mdv-toolbar .prx-seg-buttons{display:contents}
 .mdv .mdv-toolbar .prx-seg-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
 .mdv .mdv-toolbar .prx-seg{max-width:none;min-height:44px;padding:2px 4px;font-size:12px;white-space:nowrap;text-align:left}
 .mdv .mdv-toolbar>.mdv-details:not([open]){padding-inline:5px}
 .mdv .mdv-toolbar>.mdv-details[open]{padding-inline:.55rem}
 .mdv .mdv-toolbar>.mdv-details>summary{min-height:44px;padding:4px 0;font-size:12px}
 .mdv .mdv-optima{gap:.4rem}.mdv .mdv-report-button{min-width:125px;flex:1}.mdv .mdv-report-label{font-size:14px}
}
`;

/** Move complete audit content into real native disclosures; keep the base lifecycle. */
export function createVisualFrame(ctx,{mainControl,firstPreset}={}){
 ctx.root.classList.add('mdv');
 const h=ctx.h,oldCharts=[...ctx.charts.childNodes],oldControls=[...ctx.controls.childNodes].filter(n=>n!==mainControl);
 const audit=h('div',{class:'mdv-audit-summary'}),dataBody=h('div',{class:'mdv-details-body'},audit,...oldCharts),settingsBody=h('div',{class:'mdv-details-body mdv-settings prx-controls'},...oldControls);
 const settings=h('details',{class:'mdv-details','data-mdv-details':'settings','data-prx-disclosure':'settings'},h('summary',{},'Settings'),settingsBody);
 const data=h('details',{class:'mdv-details','data-mdv-details':'data','data-prx-disclosure':'data'},h('summary',{},'Data, method and exact results'),dataBody);
 const toolbar=h('div',{class:'mdv-toolbar'},settings);
 ctx.listen(toolbar,'focusin',e=>{if(e.target?.closest?.('.prx-seg-buttons'))e.target.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});});
 const stage=h('div',{class:'mdv-stage','data-mdv-stage':''}),scope=h('p',{class:'mdv-scope','data-mdv-scope':''});
 ctx.controls.replaceChildren(...(mainControl?[mainControl]:[]));
 ctx.primaryControl(mainControl);
 ctx.primaryGraphic(stage);
 ctx.charts.replaceChildren(toolbar,ctx.readout.node,stage,scope,h('div',{class:'mdv-disclosures'},data));
 const setAudit=parts=>audit.replaceChildren(h('div',{},...(Array.isArray(parts)?parts:[parts])));
 return{stage,scope,settings,data,settingsBody,dataBody,auditReadout:{set:setAudit},
  sync(){
   const presets=ctx.presets;
   if(!presets||presets.parentNode===toolbar)return;
   const first=[...presets.querySelectorAll('button[data-value]')].find(button=>button.dataset.value===firstPreset);
   if(first)first.parentNode.prepend(first);
   toolbar.prepend(presets);
  },
  setScope(parts){scope.replaceChildren(...(Array.isArray(parts)?parts:[parts]));},
  openData(){data.open=true;},
 };
}

export function svgNode(ctx,tag,attrs={},...children){const n=ctx.doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))if(v!==undefined&&v!==null)n.setAttribute(k,String(v));for(const c of children.flat(Infinity))if(c!==undefined&&c!==null)n.append(c?.nodeType?c:ctx.doc.createTextNode(String(c)));return n;}
export function svgText(ctx,x,y,text,attrs={}){return svgNode(ctx,'text',{x,y,'font-size':16,fill:'currentColor',...attrs},text);}
/** Preserve exact canonical raw text and independently checkable display metadata on SVG. */
export function svgExact(ctx,x,y,raw,options={},attrs={}){const source=exactNum(ctx,raw,options),n=svgText(ctx,x,y,source.textContent,attrs);for(const a of source.attributes)n.setAttribute(a.name,a.value);return n;}
export function svgCount(ctx,x,y,value,attrs={}){const n=svgText(ctx,x,y,formatCount(value),attrs);n.setAttribute('data-num',String(value));return n;}
export function scene(ctx,stage,{height=340,label='Profile illustration',caption}={}){
 const width=Math.max(280,Math.round(stage.getBoundingClientRect?.().width||ctx.width?.()||640));
 const svg=svgNode(ctx,'svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':label,'data-mdv-graphic':''});
 const figure=ctx.h('figure',{class:'mdv-figure'},svg,...(caption?[ctx.h('figcaption',{},caption)]:[]));stage.replaceChildren(figure);return{svg,figure,width,height,colors:palette(stage)};
}
export function setSliderFace(ctx,control,raw,{digits=0}={}){control.output.removeAttribute('data-num');control.output.replaceChildren(exactNum(ctx,raw,{style:'percent',digits}));control.input.setAttribute('aria-valuetext',formatExactText(raw,{style:'percent',digits}));}
export function reportButton(ctx,grades,{label='Optimal report',selected=false,onSelect,id,key}={}){
 if(grades?.unitIds?.length!==2||grades?.values?.length!==2)throw new TypeError('A two-unit teaching report or selected two-site view is required.');
 const b=ctx.h('button',{type:'button',class:'mdv-report-button','aria-pressed':String(selected),'data-mdv-report-id':id,'data-prx-focus-key':key??`visual-report:${id??grades.values.map(r=>r.join(',')).join('|')}`},ctx.h('span',{class:'mdv-report-label'},label));
 for(let d=0;d<grades.domainIds.length;d++){const a=grades.values[0][d],z=grades.values[1][d],ids=grades.unitIds;const text=a===z?'Withheld':a<z?`${ids[0]} → ${ids[1]}`:`${ids[1]} → ${ids[0]}`;b.append(ctx.h('span',{class:'mdv-report-line','data-prx-name':''},grades.domainIds[d]+': '+text));}
 if(onSelect)b.addEventListener('click',onSelect);return b;
}
