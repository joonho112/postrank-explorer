#!/usr/bin/env node
// Author: JoonHo Lee (jlee296@ua.edu).
// Deployment artifacts and stable routes; no external requests or model calculations.
import{existsSync,readdirSync,readFileSync,statSync}from'node:fs';import{resolve,join,relative,dirname}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function checkV35Site({root=ROOT}={}){
 const errors=[],fail=m=>errors.push(m),read=p=>readFileSync(join(root,p),'utf8');
 const catalog=JSON.parse(read('catalog.json')),apps=catalog.apps.filter(a=>a.status==='built'),parts=catalog.parts,version=read('VERSION').trim();
 const url=/^\s*site-url:\s*["']?([^"'\s]+)["']?\s*$/m.exec(read('_quarto.yml'))?.[1]?.replace(/\/$/,'')+'/';
 if(version!=='3.5.0')fail(`Expected target 3.5.0, found ${version}`);if(!url?.startsWith('https://'))fail('Configured HTTPS publication root required');
 const appPath=a=>`pages/${parts.find(p=>p.key===a.part).slug}/${a.name}.html`;
 const pages=['index.html','catalog.html','pages/words.html',...parts.map(p=>`pages/${p.slug}/index.html`),...apps.map(appPath)],embeds=apps.map(a=>`embed/${a.name}.html`),required=new Set([...pages,...embeds]);
 const found=[];function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory()){if(name!=='site_libs'&&!name.endsWith('_files'))walk(p);}else if(name.endsWith('.html'))found.push(relative(join(root,'docs'),p).split('\\').join('/'));}}
 if(existsSync(join(root,'docs')))walk(join(root,'docs'));else fail('Rendered docs directory missing');
 for(const p of required)if(!found.includes(p))fail(`Required rendered page missing: ${p}`);for(const p of found)if(!required.has(p))fail(`Unexpected rendered HTML: ${p}`);
 const canonical=html=>[...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/gi)].map(m=>m[1]);
 for(const p of pages){if(!existsSync(join(root,'docs',p)))continue;const html=read('docs/'+p),c=canonical(html);if(c.length!==1||c[0]!==url+p)fail(`Canonical mismatch: ${p}`);if(!html.includes('postrank Explorer v3.5')||!html.includes('Reference package: postrank 1.2.0'))fail(`Footer version mismatch: ${p}`);}
 for(const a of apps){const p=`embed/${a.name}.html`;if(!existsSync(join(root,'docs',p)))continue;const html=read('docs/'+p),c=canonical(html);if(c.length!==1||c[0]!==url+appPath(a))fail(`Embed canonical mismatch: ${p}`);if(html!==read(p))fail(`Source/rendered embed differs: ${p}`);}
 const sitemap=existsSync(join(root,'docs/sitemap.xml'))?[...read('docs/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]):[];for(const p of pages)if(!sitemap.includes(url+p))fail(`Sitemap missing ${p}`);if(new Set(sitemap).size!==pages.length)fail(`Sitemap count ${new Set(sitemap).size} differs from derived ${pages.length}`);
 const legacy=JSON.parse(read('verification/legacy-app-roster.json')).apps;for(const prior of legacy){const a=apps.find(a=>a.id===prior.id&&a.name===prior.name);if(!a||appPath(a)!==prior.path)fail(`Original app identity/route changed: ${prior.id} ${prior.name}`);}
 const profiles=apps.filter(a=>a.part==='P');if(profiles.length!==5)fail('Five profile applications required');for(const a of profiles){const p=`data/recipes/${a.name}.R`;if(!existsSync(join(root,'docs',p)))fail(`Recipe download missing: ${p}`);else if(read('docs/'+p)!==read(p))fail(`Recipe download differs: ${p}`);}
 if(!existsSync(join(root,'docs/.nojekyll')))fail('GitHub Pages .nojekyll marker missing');
 return{errors,version,apps:apps.length,pages:pages.length,embeds:embeds.length,html:found.length,legacyRoutes:legacy.length,recipes:profiles.length,publicationRoot:url};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const r=checkV35Site();for(const e of r.errors)console.error('FAIL '+e);console.log(`check_v35_site: ${r.apps} apps, ${r.pages} pages, ${r.embeds} embeds, ${r.legacyRoutes} preserved routes, ${r.recipes} R downloads; ${r.errors.length} failure(s)`);process.exit(r.errors.length?1:0);}catch(e){console.error(e.message);process.exit(1);}}
