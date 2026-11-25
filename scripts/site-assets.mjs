// Retain the icon definitions referenced by rendered pages and their scripts.
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,join,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {applicationNeighbors,deployedStandalone} from './navigation.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=join(root,'docs');
const stylesheet=join(output,'site_libs/bootstrap/bootstrap-icons.css');
if(existsSync(stylesheet)){
 const used=new Set();
 function visit(dir){for(const name of readdirSync(dir)){
  const path=join(dir,name);
  if(statSync(path).isDirectory())visit(path);
  else if(/\.(?:html|js)$/.test(name)){
   for(const token of readFileSync(path,'utf8').matchAll(/\bbi-[a-z0-9-]+\b/g))used.add(token[0]);
  }
 }}
 visit(output);
 const css=readFileSync(stylesheet,'utf8');
 const reduced=css.replace(/\.(bi-[a-z0-9-]+)::before\s*\{[^}]*\}/g,(rule,name)=>used.has(name)?rule:'');
 writeFileSync(stylesheet,reduced);
}
if(existsSync(output))writeFileSync(join(output,'.nojekyll'),'');

// Canonical explanatory pages keep repository-subpath deployments unambiguous.
const siteMatch=/^\s*site-url:\s*["']?([^"'\s]+)["']?\s*$/m.exec(readFileSync(join(root,'_quarto.yml'),'utf8'));
if(siteMatch){
 const base=siteMatch[1].replace(/\/$/,'')+'/',catalog=JSON.parse(readFileSync(join(root,'catalog.json'),'utf8'));
 for(const app of catalog.apps.filter(a=>a.status==='built')){
  const embed=join('embed',app.name+'.html'),target=join(output,embed);
  if(!existsSync(target))continue;
  const deployed=deployedStandalone(readFileSync(join(root,embed),'utf8'));
  if(readFileSync(target,'utf8')!==deployed)writeFileSync(target,deployed);
 }
 const navigation=JSON.parse(readFileSync(join(root,'catalog/navigation.json'),'utf8'));
 const siteCopy=JSON.parse(readFileSync(join(root,'catalog/site-copy.json'),'utf8')).apps;
 const neighbors=applicationNeighbors(navigation,catalog);
 const pages=['index.html','catalog.html','pages/words.html',...catalog.parts.map(p=>`pages/${p.slug}/index.html`),...neighbors.keys()];
 const esc=text=>String(text??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const partThumbs={uncertainty:'noisy-league',grades:'frontier',rules:'rule-comparison',criteria:'two-scores',profiles:'profile-common-vs-domain',cases:'alabama-map',tools:'report-designer'};
 const thumbFor=page=>{
  if(page==='index.html')return'noisy-league';
  if(page==='catalog.html')return'frontier';
  if(page==='pages/words.html')return'price-of-silence';
  const idx=/^pages\/([^/]+)\/index\.html$/.exec(page);if(idx)return partThumbs[idx[1]]||'frontier';
  const app=/^pages\/[^/]+\/([^/]+)\.html$/.exec(page);return app?app[1]:'frontier';
 };
 const sequenceMarker=/<!-- prx-app-sequence:start -->[\s\S]*?<!-- prx-app-sequence:end -->\n?/g;
 for(const page of pages){
  const path=join(output,page);if(!existsSync(path))continue;
  let html=readFileSync(path,'utf8').replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi,'').replace(/<meta\b[^>]*property=["']og:[^"']+["'][^>]*>\s*/gi,'').replace(sequenceMarker,'');
  const group=neighbors.get(page);
  if(group){
   const link=(app,rel,label)=>app?`<a href="${esc(posix.relative(posix.dirname(page),app.path))}" rel="${rel}"><span>${label}</span><strong>${esc(app.id+' · '+siteCopy[app.name].title)}</strong></a>`:'';
   const sequence=`<!-- prx-app-sequence:start -->\n<nav class="prx-app-sequence" aria-label="Applications in ${esc(group.label)}">${link(group.previous,'prev','Previous app')}${link(group.next,'next','Next app')}</nav>\n<!-- prx-app-sequence:end -->\n`;
   html=html.replace(/<\/main>(?:[ \t]*<!-- \/main -->)?/i,match=>`${match}\n${sequence}`);
  }
  const safeAttr=s=>String(s??'').replace(/"/g,'&quot;');
  const pageTitle=safeAttr(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g,' ').trim()||'postrank Explorer');
  const pageDesc=safeAttr(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1]||'Methods and numerical illustrations for posterior ranking, common grade reporting and multidomain profiles.');
  const ogTags=[
   `<link rel="canonical" href="${esc(base+page)}">`,
   `<meta property="og:type" content="website">`,
   `<meta property="og:title" content="${pageTitle}">`,
   `<meta property="og:description" content="${pageDesc}">`,
   `<meta property="og:url" content="${esc(base+page)}">`,
   `<meta property="og:image" content="${esc(base+'media/thumbs/'+thumbFor(page)+'.png')}">`,
  ].join('\n');
  writeFileSync(path,html.replace(/<\/head>/i,`${ogTags}\n</head>`));
 }
}
