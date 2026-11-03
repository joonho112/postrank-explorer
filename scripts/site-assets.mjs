// Retain the icon definitions referenced by rendered pages and their scripts.
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
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
