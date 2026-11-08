// Author: JoonHo Lee (jlee296@ua.edu).
// Website grouping is separate from numerical catalog identity and public routes.
export function navigationProblems(nav, parts) {
 const errors=[],fail=s=>errors.push('navigation: '+s),record=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(!record(nav)){fail('configuration required');return errors;}
 const keys=(x,allowed,where)=>{for(const k of Object.keys(x))if(!allowed.includes(k))fail(`${where}: unknown field ${k}`);};
 keys(nav,['schemaVersion','collapseBelow','sections','utilities'],'root');
 if(nav.schemaVersion!==1)fail('schemaVersion must be1');
 if(!['lg','xl'].includes(nav.collapseBelow))fail('collapseBelow must be lg or xl');
 if(!Array.isArray(nav.sections)||nav.sections.length!==6){fail('six sections required');return errors;}
 const known=new Map(parts.map(p=>[p.key,p])),used=new Set(),groups=new Set();
 const approved=[['uncertainty','Uncertainty','1',['1']],['grades','Grade reports','2',['2']],['rules','Reporting rules','3',['3']],['criteria','Multiple criteria','4',['4','P']],['cases','Cases','5',['5']],['tools','Tools','T',['T']]];
 for(const [i,s] of nav.sections.entries()){
  if(!record(s)){fail('section must be a record');continue;}
  keys(s,['key','label','landingPart','parts'],'section');
  const [key,label,landing,members]=approved[i];
  if(s.key!==key||s.label!==label||s.landingPart!==landing||!Array.isArray(s.parts)||s.parts.join('|')!==members.join('|'))fail('approved section order, labels and membership required');
  if(typeof s.key!=='string'||!/^[a-z][a-z-]*$/.test(s.key)||groups.has(s.key))fail('unique section key required');groups.add(s.key);
  if(typeof s.label!=='string'||!s.label.trim()||s.label.length>24)fail('short section label required');
  if(!known.has(s.landingPart)||s.landingPart==='P')fail('section landing must be a non-P catalog part');
  if(!Array.isArray(s.parts)||!s.parts.length||!s.parts.includes(s.landingPart)){fail('section parts must include landingPart');continue;}
  for(const key of s.parts){if(!known.has(key)||used.has(key))fail('unknown or repeated part '+key);used.add(key);}
 }
 for(const p of parts)if(!used.has(p.key))fail('unreachable part '+p.key);
 const criteria=nav.sections.find(s=>s?.landingPart==='4');if(!criteria?.parts?.includes('P'))fail('profiles must belong to Multiple criteria');
 const utilities=[{label:'Catalog',href:'catalog.qmd'},{label:'Terminology',href:'pages/words.qmd'}];
 if(!Array.isArray(nav.utilities)||nav.utilities.length!==utilities.length)fail('Catalog and Terminology utility routes required');
 else nav.utilities.forEach((u,i)=>{if(!record(u)||Object.keys(u).some(k=>!['label','href'].includes(k))||u.label!==utilities[i].label||u.href!==utilities[i].href)fail('Catalog and Terminology utility routes required');});
 return errors;
}

export function navigationGroups(nav, parts) {
 const byPart=new Map(parts.map(p=>[p.key,p]));
 return nav.sections.map(s=>({key:s.key,label:s.label,landing:`pages/${byPart.get(s.landingPart).slug}/index.html`,slugs:s.parts.map(k=>byPart.get(k).slug)}));
}

/** Built applications in each approved category's reading order. */
export function applicationNeighbors(nav, catalog) {
 const slugByPart = new Map(catalog.parts.map(part => [part.key, part.slug]));
 const appsByPart = new Map(catalog.parts.map(part => [part.key, []]));
 for (const app of catalog.apps.filter(app => app.status === 'built')) {
  appsByPart.get(app.part).push({ id: app.id, name: app.name, path: `pages/${slugByPart.get(app.part)}/${app.name}.html` });
 }
 const result = new Map();
 for (const section of nav.sections) {
  const apps = section.parts.flatMap(part => appsByPart.get(part));
  apps.forEach((app, index) => result.set(app.path, { label: section.label, previous: apps[index - 1], next: apps[index + 1] }));
 }
 return result;
}

export function activeNavigationHtml(nav, parts) {
 const groups=JSON.stringify(navigationGroups(nav,parts)).replaceAll('<','\\u003c');
 return `<!-- Website navigation groups; generated from catalog/navigation.json. -->
<noscript><style>.navbar .navbar-collapse{display:block!important}.navbar .navbar-toggler{display:none!important}.navbar .dropdown-menu{display:block!important;position:static!important;max-height:none!important;box-shadow:none!important}.navbar .dropdown-toggle::after{display:none}</style></noscript>
<script>
(function(){
  const groups=${groups};
  function apply(){
    const brand=document.querySelector('.navbar-brand[href]');if(!brand)return;
    const root=new URL('.',brand.href),here=new URL(location.href);
    if(here.protocol!==root.protocol||here.host!==root.host||!here.pathname.startsWith(root.pathname))return;
    const normal=p=>p.replace(/index\\.html$/,'');
    const links=[...document.querySelectorAll('.navbar .nav-link')];
    const managed=groups.map(g=>({g,a:document.getElementById('nav-menu-prx-nav-'+g.key)||document.getElementById('prx-nav-'+g.key)||links.find(a=>a.textContent.trim()===g.label)})).filter(x=>x.a);
    for(const {a}of managed){
      a.classList.remove('active');a.removeAttribute('aria-current');
      for(const child of a.closest('.nav-item')?.querySelectorAll('.dropdown-item')||[]){child.classList.remove('active');child.removeAttribute('aria-current');}
      if(a.classList.contains('dropdown-toggle')){
        a.setAttribute('role','button');a.setAttribute('aria-haspopup','true');
        if(!a.dataset.prxKeyboard){a.dataset.prxKeyboard='true';a.addEventListener('keydown',function(e){if(e.key===' '){e.preventDefault();a.click();}});}
      }
    }
    const match=managed.find(({g})=>g.slugs.some(slug=>here.pathname.startsWith(new URL('pages/'+slug+'/',root).pathname)));
    if(match){
      match.a.classList.add('active');match.a.setAttribute('aria-current',normal(here.pathname)===normal(new URL(match.g.landing,root).pathname)?'page':'location');
      const children=[...match.a.closest('.nav-item')?.querySelectorAll('.dropdown-item[href]')||[]].filter(a=>normal(new URL(a.href).pathname)===normal(here.pathname));
      const current=children.find(a=>new URL(a.href).hash&&new URL(a.href).hash===here.hash)||children.find(a=>!new URL(a.href).hash);
      if(current){current.classList.add('active');current.setAttribute('aria-current',new URL(current.href).hash?'location':'page');}
    }
    const toggle=document.querySelector('.navbar-toggler');if(toggle){toggle.removeAttribute('role');toggle.setAttribute('aria-label','Navigation menu');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.addEventListener('hashchange',apply);
})();
</script>
`;
}
