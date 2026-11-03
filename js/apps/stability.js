// Fixed-truth, paired repeated measurements. Each observation refits a stipulated posterior; reports are not posterior draws.
import { createWidget, uid } from "../shared/base.js";
import { plot, gradeColors, labelOn, numText, palette as ctxPalette } from "../shared/chart.js";
import { formatCount, formatExpectedCount, formatGrades, formatRisk, formatSetting, formatShare } from "../shared/format.js";
import { captionNode, labelNode } from "../shared/labels.js";
import { leagueModel } from "./fixed-tiers.js";
import { CSS as REPORT_CSS, createRuleCardRenderer } from "./posterior-tiers.js";
import { LEAGUE_SEED, disclosedErrorEstimands, evaluateReport, fixedOrderDP, league30, pairCount, relationChange, relations, scoreOrder, summaryStats, tierGrades } from "../pr-core.js";

export const CONFIG = Object.freeze({ seedMax: 4294967295, defaultSeed: LEAGUE_SEED, maxReplays: 100,
  rules: ["pm-cuts", "est-tiers", "post-tiers", "withheld"],
  names: { "pm-cuts": "Optimal posterior-mean cuts", "est-tiers": "Estimate tiers", "post-tiers": "Posterior-mean tiers", withheld: "Withhold every pair" } });
const LEAGUE = league30(), IDS = Array.from(LEAGUE.ids), M = pairCount(IDS.length);
/** Disjoint paired measurement streams, cycling through the inclusive nonzero uint32 seed domain. */
export function pairedSeeds(seed, pair) { const at = offset => 1 + ((seed - 1 + offset) % CONFIG.seedMax); return [at(2 * (pair - 1)), at(2 * (pair - 1) + 1)]; }
const models = new Map(), reports = new Map();
const remember = (cache,key,value,max=220) => { if(cache.size>=max)cache.delete(cache.keys().next().value);cache.set(key,value);return value; };
function observation(seed,s) {
  const modelKey = `${seed}/${s.priorSd}`;
  const model = models.get(modelKey) ?? remember(models,modelKey,leagueModel(seed,s.priorSd));
  const key = `${modelKey}/${s.G}/${s.tau}`;
  if(reports.has(key))return reports.get(key);
  const grades = { "est-tiers": tierGrades(model.estimate,s.G,{direction:"descending"}), "post-tiers":tierGrades(model.post.mean,s.G,{direction:"descending"}), withheld:IDS.map(()=>1) };
  const dp = fixedOrderDP(model.E,{scores:model.post.mean,direction:"descending",G:s.G,tau:s.tau});
  grades["pm-cuts"] = dp.grade;
  const byRule = Object.fromEntries(CONFIG.rules.map(rule=>[rule,{...(rule==="pm-cuts"?dp:{}),grade:Array.from(grades[rule]),ev:evaluateReport(grades[rule],model.E,{tau:s.tau})}]));
  return remember(reports,key,{model,byRule});
}
/** Public-engine composition, shared by the selected pair and every replay/rule. */
export function measurementPair(s,pair=s.pair) {
  const seeds=pairedSeeds(s.seed,pair),a=observation(seeds[0],s),b=observation(seeds[1],s);
  return {pair,seeds,a,b,byRule:Object.fromEntries(CONFIG.rules.map(rule=>[rule,{a:a.byRule[rule],b:b.byRule[rule],change:relationChange(a.byRule[rule].grade,b.byRule[rule].grade)}]))};
}
function compactPair(p) {return {pair:p.pair,seeds:p.seeds,byRule:Object.fromEntries(CONFIG.rules.map(rule=>{const r=p.byRule[rule];return [rule,{a:r.a.ev,b:r.b.ev,change:r.change.changeShare,changed:r.change.changed}];}))};}
const CSS = REPORT_CSS + `
.prx-st .st-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:1rem;align-items:start}
.prx-st .st-controls{display:flex;flex-wrap:wrap;gap:.6rem 1rem;width:100%;align-items:end}.prx-st .st-controls>*{flex:1 1 13rem}
.prx-st .st-pair-figures{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,23rem),1fr));gap:1rem}
.prx-st .st-card{min-width:0;border:1px solid var(--prx-border);border-radius:6px;padding:.55rem .7rem}
.prx-st .st-note{font-size:.9em;color:var(--prx-fg-muted);margin:.4rem 0}.prx-st .st-progress{min-height:1.5em;font-size:.9em;color:var(--prx-fg-muted)}
.prx-st .st-scroll{overflow-x:auto;max-width:100%;min-width:0}.prx-st .st-table{width:100%;border-collapse:collapse;font-size:.88em;font-variant-numeric:tabular-nums;margin:.5rem 0}
.prx-st .st-table th,.prx-st .st-table td{padding:.4rem .5rem;text-align:right;border-bottom:1px solid var(--prx-border);white-space:nowrap}
.prx-st .st-table th:first-child{text-align:left}.prx-st .st-table caption{text-align:left;font-weight:600}.prx-st .st-table .st-selected{font-weight:700;background:var(--prx-bg-raised)}
.prx-st .st-hero{margin:.3rem 0 .8rem}.prx-st .st-hero h4{font-size:1rem;margin:.1rem 0 .4rem}.prx-st .st-hero .prx-pt-row{margin:0}
.prx-st .st-legend{display:flex;flex-wrap:wrap;gap:.4rem 1rem;font-size:.86em}
.prx-st .st-reference-key{display:flex;flex-wrap:wrap;gap:.25rem 1rem}.prx-st .st-scroll-hint{display:none}
@media(max-width:42rem){.prx-st .st-scroll-hint{display:block}}

.prx-st [hidden]{display:none!important}.prx-st .st-matrix{max-width:37rem}.prx-st .prx-number input{max-width:14rem}
`;

export function mountWidget(el,spec={}) {
  return createWidget(el,spec,{name:"stability",className:"prx-st prx-pt",css:CSS,title:"Same truth, two measurements, new reports",
    keys:{rule:{type:"choice",values:CONFIG.rules,value:"pm-cuts"},G:{type:"integer",min:1,max:10,step:1,value:3},
      tau:{type:"number",min:.02,max:.5,step:.01,value:.2},priorSd:{type:"number",min:.02,max:.4,step:.01,value:.15},
      replays:{type:"integer",min:1,max:CONFIG.maxReplays,step:1,value:20},pair:{type:"integer",min:1,max:CONFIG.maxReplays,step:1,value:1},
      seed:{type:"integer",min:1,max:CONFIG.seedMax,step:1,value:CONFIG.defaultSeed}},
    build(ctx){
      const {h}=ctx, num=(v,f=formatCount)=>ctx.num(v,f(v)),ro=(key,v,f=formatCount)=>{const n=num(v,f);n.setAttribute("data-prx-readout",key);return n;};
      const note=(...parts)=>h("p",{class:"st-note"},...parts), scroll=(node,label)=>ctx.scrollRegion(h("div",{class:"st-scroll"},node),label);
      const cards=createRuleCardRenderer(ctx), hero=h("div",{class:"st-grid st-hero"});ctx.controls.before(ctx.readout.node,hero);
      const rule=ctx.select({label:"Report rule",name:"rule",options:CONFIG.rules.map(value=>({value,label:CONFIG.names[value]})),value:ctx.state.rule,onChange:v=>ctx.set({rule:v})});
      const G=ctx.slider({label:"Tier count / cut grade cap",...ctx.key("G"),format:formatCount,onInput:v=>ctx.set({G:v})});
      const tau=ctx.slider({label:"Withholding cost τ",...ctx.key("tau"),onInput:v=>ctx.set({tau:v})});
      const prior=ctx.slider({label:"Assumed prior SD",...ctx.key("priorSd"),hint:"Fixed prior mean zero; each measurement gets its own posterior. No prior hyperparameter is fitted.",onInput:v=>ctx.set({priorSd:v})});
      const replays=ctx.slider({label:"Paired remeasurements",...ctx.key("replays"),format:formatCount,onInput:v=>ctx.set({replays:v})});
      const seed=ctx.numberInput({label:"First measurement seed",...ctx.key("seed"),onInput:v=>ctx.set({seed:v})});
      // Native range semantics read the CURRENT max, including keyboard End. Set max before value on every render.
      const pairId=uid("st-pair"),pairInput=h("input",{id:pairId,type:"range",name:"pair",min:1,max:ctx.state.replays,step:1,"data-prx-focus-key":"slider:pair"}),pairOutput=h("output",{for:pairId,"aria-hidden":"true"});
      const pairControl=h("div",{class:"prx-control prx-slider"},h("label",{for:pairId},"Inspect measurement pair"),pairInput,pairOutput);
      ctx.listen(pairInput,"input",()=>ctx.set({pair:Number(pairInput.value)}));
      let current=ctx.state,dead=false,active=null,selectedKey=null;const pools=new Map();
      const redraw=ctx.button({label:"New measurement pairs",primary:true,key:"st:new-pairs",onClick:()=>ctx.set({seed:pairedSeeds(current.seed,current.replays+1)[0],pair:1})});
      ctx.controls.append(h("div",{class:"st-controls"},rule.root,G.root,tau.root,prior.root,replays.root,pairControl,seed.root,redraw.root));
      const progress=h("p",{class:"st-progress","data-prx-progress":""}),experiment=note("Fixed truth: the same ",num(IDS.length)," units and their SEs. Two independent normal measurement errors per pair; a new stipulated normal posterior is computed for each observation. The same pairs are used for every rule.");
      const plotSlots=[h("div"),h("div")],reportNotes=[h("div"),h("div")];
      const observations=h("div",{class:"st-pair-figures"},...["A","B"].map((name,i)=>h("section",{class:"st-card"},ctx.panelTitle(`Observation ${name}: the same units`),plotSlots[i],reportNotes[i])));
      const changeTitle=h("div"),changeSlot=h("div",{class:"st-matrix prx-light-panel"}),changeTable=h("div",{class:"st-scroll"});ctx.scrollRegion(changeTable,"Changed pairs: from the first report to the second");
      const changeLegend=h("div",{class:"st-legend prx-light-panel"},...["□ Unchanged","● Newly stated","○ Newly withheld","× Reversed"].map(x=>h("span",{},x)));
      const histogram=h("div"),histogramKey=h("p",{class:"st-note st-reference-key","data-prx-histogram-key":""}),summary=h("div"),sampling=h("div");
      ctx.charts.append(experiment,observations,ctx.panelTitle("Which pair relations changed?"),changeTitle,changeLegend,changeSlot,
        ctx.panelTitle("Repeat the two-measurement experiment"),progress,histogram,histogramKey,summary,sampling,ctx.panelTitle("Inspect the changed pairs"),changeTable);
      ctx.onCleanup(()=>{dead=true;active=null;});
      const ownClaim=(r,key)=>note("Pairs stated ",ro(`${key}-N`,r.ev.N)," of ",num(M)," (N/M ",ro(`${key}-s`,r.ev.s,formatShare),
        "). Claimed E/N ",ro(`${key}-EN`,r.ev.EoverN[0],formatShare),"; expected wrong count E ",ro(`${key}-E`,r.ev.Ew,formatExpectedCount),"; risk ",ro(`${key}-risk`,r.ev.risk,formatRisk)," under this observation’s supplied posterior.");
      function drawSelected(s,p){
        const r=p.byRule[s.rule];
        hero.replaceChildren(...[r.a,r.b].map((value,i)=>{
          const model=i?p.b.model:p.a.model,head=h("h4",{},`Observation ${i?"B":"A"}: `,CONFIG.names[s.rule]);
          let card;
          if(s.rule==="pm-cuts"||s.rule==="post-tiers"){
            const row=cards.drawRow({ids:IDS,n:IDS.length,fraction:false,pmOrder:scoreOrder(model.post.mean,{direction:"descending"}).order},s.rule==="pm-cuts"?"pm-cuts":"pm-tiers",value,null,s.G,false,currentPalette(),false);
            // Both source cards expose their OWN result object, even when their order-family names coincide.
            if(s.rule==="pm-cuts")row.querySelector("[data-prx-label]")?.replaceWith(labelNode(ctx,value,{key:i?"measurement-b":"measurement-a"}));
            card=h("ol",{class:"prx-pt-rows"},row);
          }
          else card=h("div",{class:"prx-pt-row prx-light-panel"},cards.chips({ids:IDS,n:IDS.length},value.grade,currentPalette()),h("p",{},s.rule==="withheld"?captionNode(ctx,"fixed-report"):captionNode(ctx,"fixed-tiers")));
          return h("section",{class:"st-card"},head,card,ownClaim(value,i?"b":"a"),note("Measurement seed ",ro(i?"seedB":"seedA",p.seeds[i]),"."),h("p",{class:"prx-sr-only"},"Grade vector in unit ID order: ",ro(i?"b-grades":"a-grades",value.grade,formatGrades)));
        }));
        const modelsAB=[p.a.model,p.b.model],bounds=modelsAB.flatMap(m=>m.estimate.flatMap((v,i)=>[v-m.se[i],v+m.se[i],m.post.mean[i],LEAGUE.theta[i]]));
        const lo=Math.min(...bounds),hi=Math.max(...bounds),domain=[lo-(hi-lo)*.06,hi+(hi-lo)*.06];
        modelsAB.forEach((m,i)=>drawRows(plotSlots[i],m,(i?r.b:r.a).grade,domain));
        reportNotes.forEach((slot,i)=>slot.replaceChildren(note("Line: estimate ± one SE; vermillion tick: estimate; navy dot: posterior mean; open circle: the SAME fixed truth; numbered chip: report grade.")));
        changeTitle.replaceChildren(note("Pair ",ro("pair",s.pair),": ",ro("changed",r.change.changed)," of ",ro("M",r.change.M)," relations changed (",ro("changeShare",r.change.changeShare,formatShare),
          "). Newly stated ",ro("newStated",r.change.nNewDisclosed),"; newly withheld ",ro("newWithheld",r.change.nNewWithheld),"; reversed ",ro("reversed",r.change.nReversed),"; unchanged ",ro("same",r.change.nSame),"."),
          note("A relation is above, below or withheld. This denominator includes ALL unordered pairs, including moves to or from withholding. A shared grade makes no equality claim."));
        drawChanges(r);
        ctx.readout.set(["Inspected pair ",num(s.pair),", ",CONFIG.names[s.rule],": ",num(r.change.changed)," of ",num(M)," pair relations change. N/M is ",num(r.a.ev.s,formatShare)," then ",num(r.b.ev.s,formatShare),"; each claimed E/N uses its own measurement’s posterior."]);
      }
      function drawRows(slot,m,grade,domain){
        const points=IDS.map((id,i)=>({id,i,estimate:m.estimate[i],se:m.se[i],lo:m.estimate[i]-m.se[i],hi:m.estimate[i]+m.se[i],mean:m.post.mean[i],truth:LEAGUE.theta[i],grade:grade[i],chip:domain[1]}));
        const title=d=>`${d.id}: estimate ${formatSetting(d.estimate)}, SE ${formatSetting(d.se)}, posterior mean ${formatSetting(d.mean)}, fixed truth ${formatSetting(d.truth)}, grade ${formatCount(d.grade)}.`;
        plot(slot,{height:IDS.length*15+55,marginLeft:38,marginRight:32,marginTop:10,marginBottom:40,x:{domain,label:"Value on the same scale",grid:true},y:{domain:IDS,label:null},
          marks:(c,P)=>{const colors=gradeColors(Math.max(...grade),c);return [P.ruleX([0],{stroke:c.plotGrid}),P.ruleY(points,{y:"id",x1:"lo",x2:"hi",stroke:c.plotMuted}),P.tickX(points,{x:"estimate",y:"id",stroke:c.est,strokeWidth:2.5}),
            P.dot(points,{x:"mean",y:"id",fill:c.post,r:3}),P.dot(points,{x:"truth",y:"id",fill:c.plotBg,stroke:c.plotFg,r:3}),
            P.dot(points,{x:"chip",y:"id",fill:d=>colors[d.grade-1],r:7}),numText(points,{x:"chip",y:"id",value:"grade",format:v=>formatCount(v),fill:d=>labelOn(colors[d.grade-1],c),fontSize:9}),P.tip(points,P.pointerY({x:"estimate",y:"id",title}))];},
          alt:"The same thirty units in fixed ID order: each measurement's estimate, one-SE line, posterior mean, fixed truth and report grade. Neither observation reuses the other's posterior.",
          keyboard:{data:points,x:"estimate",y:"id",key:"id",sort:false,title},
          table:{caption:"Every unit's measurement and report",columns:[{label:"Unit",value:"id"},{label:"Estimate",value:"estimate",format:v=>formatSetting(v)},{label:"SE",value:"se",format:v=>formatSetting(v)},{label:"Posterior mean",value:"mean",format:v=>formatSetting(v)},{label:"Fixed truth",value:"truth",format:v=>formatSetting(v)},{label:"Grade",value:"grade",format:v=>formatCount(v)}],rows:points}});
      }
      function drawChanges(r){
        const changes=new Map(r.change.pairs.map(p=>[`${p.i}/${p.j}`,p])),before=relations(r.a.grade),after=relations(r.b.grade),words={1:"above",0:"withheld","-1":"below"},cells=[];
        for(let i=0;i<IDS.length;i++)for(let j=i+1;j<IDS.length;j++){
          const p=changes.get(`${i}/${j}`),kind=!p?"Unchanged":p.from==="withheld"?"Newly stated":p.to==="withheld"?"Newly withheld":"Reversed";
          cells.push({i,j,row:IDS[i],col:IDS[j],from:words[before[i][j]],to:words[after[i][j]],kind});
        }
        const wide=(changeSlot.clientWidth||Math.min(ctx.width(),592))>=460;
        plot(changeSlot,{height:Math.max(300,Math.min(550,ctx.width()*.65)),marginTop:wide?42:8,marginLeft:wide?40:8,marginRight:8,marginBottom:8,
          x:{domain:IDS,label:null,axis:wide?"top":null,tickRotate:-90,tickSize:0},y:{domain:IDS,label:null,axis:wide?"left":null,tickSize:0},
          marks:(c,P)=>[P.cell(cells,{x:"col",y:"row",fill:c.plotBg,stroke:c.plotGrid,strokeWidth:.7,inset:.4}),
            P.dot(cells.filter(d=>d.kind==="Newly stated"),{x:"col",y:"row",fill:c.plotFg,r:2.5}),
            P.dot(cells.filter(d=>d.kind==="Newly withheld"),{x:"col",y:"row",fill:c.plotBg,stroke:c.plotFg,strokeWidth:1.2,r:2.5}),
            P.dot(cells.filter(d=>d.kind==="Reversed"),{x:"col",y:"row",symbol:"times",stroke:c.plotFg,strokeWidth:1.2,r:3})],
          alt:"One outlined cell for every unordered pair, in unit ID order. Empty cells are unchanged, filled circles newly stated, open circles newly withheld, crosses reversed from observation A to B. Use arrow keys for the unit names and relations.",
          keyboard:{data:cells,x:"col",y:"row",key:d=>`${d.i}/${d.j}`,sort:false,title:d=>`${d.row} relative to ${d.col}: ${d.from} then ${d.to}; ${d.kind}.`},
          table:{caption:"All pair relations before and after remeasurement",columns:[{label:"Row unit",value:"row"},{label:"Column unit",value:"col"},{label:"Before",value:"from"},{label:"After",value:"to"},{label:"Change",value:"kind"}],rows:cells}});
        const changed=cells.filter(c=>c.kind!=="Unchanged");
        const changedRows = changed.map(c => h("tr", {}, ...["row","col","from","to","kind"].map(k =>
          h("td", {}, h("span", {"data-prx-name": k === "row" || k === "col" ? "" : null}, c[k])))));
        const table = h("table", {class:"st-table"}, h("caption", {}, "Changed relations in the selected pair"),
          h("thead", {}, h("tr", {}, ...["Row unit","Column unit","Before","After","Change"].map(x => h("th", {scope:"col"}, x)))),
          h("tbody", {}, ...changedRows));
        changeTable.replaceChildren(table);
      }
      function renderPool(s,pool){
        const rows=CONFIG.rules.map(rule=>{
          const trace=pool.map(p=>p.byRule[rule]),claims=trace.flatMap(t=>[{A:t.a.Ew,N:t.a.N},{A:t.b.Ew,N:t.b.N}]);
          return {rule,name:CONFIG.names[rule],mean:summaryStats(trace.map(t=>t.change)).mean,estimands:disclosedErrorEstimands(claims,{M})};
        });
        const row=rows.find(r=>r.rule===s.rule),points=pool.map(p=>({pair:p.pair,share:p.byRule[s.rule].change}));
        const bins=Array.from({length:20},(_,i)=>({from:i/20,to:(i+1)/20,count:0}));points.forEach(p=>bins[Math.min(19,Math.floor(p.share*20))].count++);
        plot(histogram,{height:250,marginLeft:50,marginBottom:40,x:{domain:[0,1],label:"Share of all pair relations changed"},y:{label:"Measurement pairs",grid:true},
          marks:(c,P)=>[P.rectY(bins,{x1:"from",x2:"to",y:"count",fill:c.plotFg,inset:1}),P.ruleX([row.mean],{stroke:c.plotFg,strokeDasharray:"4 3"}),P.ruleX([points[s.pair-1].share],{stroke:c.plotMuted,strokeWidth:2})],
          alt:"Histogram of relation-change shares over disjoint measurement pairs for the selected rule. Dashed line is the replay mean; solid line marks the inspected pair.",
          keyboard:{data:bins,x:d=>(d.from+d.to)/2,y:"count",key:d=>d.from,title:d=>`Changed share ${formatShare(d.from)} to ${formatShare(d.to)}: ${formatCount(d.count)} measurement pairs.`},
          table:{caption:"Each paired measurement's changed share",columns:[{label:"Pair",value:"pair",format:formatCount},{label:"Changed share",value:"share",format:formatShare}],rows:points}});
        histogramKey.replaceChildren(h("span",{},"Dashed line: mean across measurement pairs ",num(row.mean,formatShare),"."),
          h("span",{},"Solid line: inspected pair ",num(s.pair),", changed share ",num(points[s.pair-1].share,formatShare),"."));
        const tableRows = rows.map(r => h("tr", {class:r.rule===s.rule?"st-selected":null,"data-prx-summary":r.rule},
          h("th", {scope:"row"}, r.name), h("td", {}, ro(`mean-change-${r.rule}`,r.mean,formatShare)),
          h("td", {}, ro(`mean-disclosure-${r.rule}`,r.estimands.meanDisclosure,formatShare)),
          h("td", {}, ro(`pooled-claim-${r.rule}`,r.estimands.ERR,formatShare)),
          h("td", {}, ctx.button({label:"View",key:`view:${r.rule}`,onClick:()=>ctx.set({rule:r.rule})}).root)));
        const table = h("table", {class:"st-table"}, h("caption", {}, "Same paired measurements for every rule"),
          h("thead", {}, h("tr", {}, ...["Rule","Mean changed / M","Mean N / M","Pooled claimed E / N","Inspect"].map(x=>h("th",{scope:"col"},x)))),
          h("tbody", {}, ...tableRows));
        summary.replaceChildren(h("p",{class:"st-note st-scroll-hint"},"Scroll the table sideways to compare disclosure and claimed errors."),scroll(table,"Stability, disclosure and claimed errors for all rules"),
          note("Mean changed/M averages the paired relation-change shares. Mean N/M averages disclosure across BOTH observations. Pooled claimed E/N is the sum of their posterior expected wrong counts divided by the sum of stated pairs; it is not the mean of the individual fractions. NA means there was no disclosure."));
        sampling.replaceChildren(note("Monte Carlo: ",ro("replays",s.replays)," paired remeasurements, ",num(2*s.replays)," distinct measurement seeds, first seed ",num(s.seed),". Consecutive pairs use consecutive nonoverlapping seed pairs; seeds cycle through ",num(1)," to ",num(CONFIG.seedMax),". Every rule uses the SAME pairs. No auxiliary lottery is used."),
          note("This is a fixed-truth measurement experiment, not posterior draws at fixed data or a calibration identity. Claimed errors use each observation’s stipulated prior, not a claim that it is the true conditional law. A constant all-withheld report is stable but discloses nothing; reporting-risk optimality does not guarantee stability."));
        progress.replaceChildren("Complete: ",num(pool.length)," paired remeasurements.");
      }
      function startPool(s,key){
        const job={key,s:{...s},rows:[]};active=job;histogram.replaceChildren();histogramKey.replaceChildren();summary.replaceChildren();sampling.replaceChildren();
        const run=()=>{
          if(dead||active!==job)return;
          const stop=Math.min(job.rows.length+2,job.s.replays);
          while(job.rows.length<stop)job.rows.push(compactPair(measurementPair(job.s,job.rows.length+1)));
          progress.replaceChildren("Computing paired remeasurements: ",num(job.rows.length)," of ",num(job.s.replays),".");
          if(job.rows.length<job.s.replays)ctx.timeout(run,0);
          else{remember(pools,key,job.rows,4);active=null;ctx.requestRender("paired-replays-ready");}
        };ctx.timeout(run,0);
      }
      function currentPalette(){return ctxPalette(ctx.root);}
      return {render(s){
        if(s.pair>s.replays){ctx.set({pair:s.replays});return;}
        current=s;rule.set(s.rule);G.set(s.G);tau.set(s.tau);prior.set(s.priorSd);replays.set(s.replays);seed.set(s.seed);
        pairInput.max=String(s.replays);pairInput.value=String(s.pair);pairInput.setAttribute("aria-valuetext",`Pair ${formatCount(s.pair)} of ${formatCount(s.replays)}`);pairOutput.replaceChildren(num(s.pair));
        const key=`${s.seed}/${s.priorSd}/${s.G}/${s.tau}/${s.replays}`,viewKey=`${s.seed}/${s.priorSd}/${s.G}/${s.tau}/${s.pair}/${s.rule}/${ctx.width()}/${ctx.doc.documentElement.dataset.theme}`;
        if(selectedKey!==viewKey){drawSelected(s,measurementPair(s));selectedKey=viewKey;}
        const pool=pools.get(key);
        if(pool){active=null;ctx.root.removeAttribute("aria-busy");renderPool(s,pool);}
        else{ctx.root.setAttribute("aria-busy","true");if(active?.key!==key)startPool(s,key);}
        ctx.caption.replaceChildren("Same fixed league truth and known SEs; independent normal measurement errors; prior mean ",num(0),", assumed prior SD ",num(s.priorSd,formatSetting),"; ",captionNode(ctx,"teaching-posterior"),". The estimates change; the truth does not.");
      }};
    }});
}
