// Author: JoonHo Lee (jlee296@ua.edu).
// Native-disclosure-aware page policy for the five visual profile pages only.
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(new URL('../tools/package.json',import.meta.url))('jsdom');
const words=text=>text.split(/\s+/).filter(w=>/[\p{L}\p{N}]/u.test(w)).length;
export function profilePagePolicy(html,{name,max=160}={}){
 const dom=new JSDOM(html),doc=dom.window.document,main=doc.querySelector('main'),problems=[];
 if(!main){dom.window.close();return{visibleWords:0,closedWords:0,hiddenWords:0,problems:['Missing main element']};}
 const app=main.querySelector('#app');if(!app)problems.push('Missing app mount');
 if(!main.querySelector('#what-to-try'))problems.push('Missing #what-to-try');
 if(![...main.querySelectorAll('details')].some(n=>[...n.children].some(c=>c.tagName==='SUMMARY')))problems.push('Missing native method disclosure');
 const links=[...main.querySelectorAll('a[href]')].map(n=>n.getAttribute('href'));
 if(!links.some(h=>h.includes(`data/recipes/${name}.R`)))problems.push('Missing self-contained R recipe link');
 if(!links.some(h=>h.includes(`embed/${name}.html`)))problems.push('Missing standalone link');
 if(!links.some(h=>/^https:\/\//.test(h)))problems.push('Missing source link');
 main.querySelectorAll('header#title-block-header,#app,script,style,noscript,pre,code').forEach(n=>n.remove());
 const groups={visible:[],closed:[],hidden:[]},walk=doc.createTreeWalker(main,dom.window.NodeFilter.SHOW_TEXT);
 for(let node=walk.nextNode();node;node=walk.nextNode()){
  let kind='visible';
  for(let p=node.parentElement;p&&p!==main.parentElement;p=p.parentElement){
   if(p.tagName==='DETAILS'&&!p.open){const summary=[...p.children].find(c=>c.tagName==='SUMMARY');if(!summary?.contains(node))kind='closed';}
   if(p.hidden||p.getAttribute('aria-hidden')==='true'||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(p.getAttribute('style')??'')) {kind='hidden';break;}
  }
  groups[kind].push(node.textContent);
 }
 const result={visibleWords:words(groups.visible.join(' ')),closedWords:words(groups.closed.join(' ')),hiddenWords:words(groups.hidden.join(' ')),maxVisibleWords:max,problems};
 if(result.visibleWords>max)problems.push(`Visible prose ${result.visibleWords} exceeds ${max}; no minimum applies`);
 dom.window.close();return result;
}
