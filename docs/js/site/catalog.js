// Public static catalog only: no requests, saved records or external libraries.
(() => {
  const root=document.querySelector('[data-catalog]');if(!root)return;
  const form=root.querySelector('form'),cards=[...root.querySelectorAll('.prx-card')],status=root.querySelector('[role=status]'),empty=root.querySelector('.prx-catalog-empty');
  const keys=['query','part','topic','data'],controls=Object.fromEntries(keys.map(k=>[k,form.elements.namedItem(k)]));
  const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/τ/g,' tau ').replace(/λ/g,' lambda ').replace(/π/g,' pi ').replace(/δ/g,' delta ');
  const index=cards.map(card=>({card,text:normalize(card.dataset.search),part:card.dataset.part,topics:card.dataset.topics.split(' '),data:card.dataset.data.split(' ')}));
  const apply=(save=true)=>{
    const state=Object.fromEntries(keys.map(k=>[k,controls[k].value])),words=normalize(state.query).trim().split(/\s+/).filter(Boolean);let count=0;
    for(const row of index){const match=(!state.part||row.part===state.part)&&(!state.topic||row.topics.includes(state.topic))&&(!state.data||row.data.includes(state.data))&&words.every(w=>row.text.includes(w));row.card.hidden=!match;if(match)count++;}
    status.textContent=`${count} of ${cards.length} apps`;empty.hidden=count!==0;form.querySelector('button[type=reset]').disabled=keys.every(k=>!state[k]);
    if(save){const url=new URL(location.href);for(const key of keys){if(state[key])url.searchParams.set(key,state[key]);else url.searchParams.delete(key);}try{history.replaceState(null,'',url);}catch{/* Filtering remains usable in a restrictive file viewer. */}}
  };
  const restore=()=>{const query=new URLSearchParams(location.search);for(const key of keys){const input=controls[key],value=query.get(key)??'';input.value=key==='query'||[...input.options].some(o=>o.value===value)?value:'';}apply(false);};
  form.hidden=false;restore();form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',()=>apply());form.addEventListener('change',()=>apply());form.addEventListener('reset',event=>{event.preventDefault();for(const key of keys)controls[key].value='';apply();controls.query.focus();});addEventListener('popstate',restore);
})();
