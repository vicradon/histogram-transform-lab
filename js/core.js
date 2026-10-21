/* ==== App: shared state ========================================================================== */
// The active tab's sessions live in App.sessions/App.cur; the other tabs' are parked in Core's ST until switched to.
const App={sessions:[],cur:null,nid:1,tab:'hist'};


/* ==== 2. CORE: sessions, persistence, undo, tabs, theme, PDF helpers ================================== */
const Core=(()=>{
const{applyLut,hist,lutOf,toGray,TR}=Algos;

// Tab registry. Each tab registers {render, paint, exportPdf?, thumb?, newSession?, noImages?}.
const TABS={};
function registerTab(name,hooks){TABS[name]=hooks}
const $=id=>document.getElementById(id);
// The "no image yet" placeholder shared by the image tabs. Returns true when it was shown (caller then stops rendering).
// Clicking or pressing Enter/Space on it opens the file picker (listeners on #main, below).
function emptyState(m,hint){if(App.cur&&!App.cur.empty)return false;
 m.innerHTML=`<div class="empty" role="button" tabindex="0"><b>${App.cur?'This session is empty: paste, drop or open an image into it':'Paste an image to start a session'}</b>${hint}</div>`;return true}
function compute(s){
 if(s.empty)return;
 s.nodes.forEach(n=>{
  if(n.root){n.out=s.gray?toGray(s.rgba):s.rgba;n.h=hist(n.out);return}
  const par=s.nodes.find(x=>x.id===n.parent);
  n.inH=par.h;n.lut=lutOf(n);n.out=applyLut(par.out,n.lut);n.h=hist(n.out);
 });
}
function paintImg(c,s,d){c.width=s.w;c.height=s.h;c.getContext('2d').putImageData(new ImageData(d,s.w,s.h),0,0)}
// Histogram with an optional T(r) curve over it (square when a curve is drawn, short strip otherwise).
// One painter, two palettes: the live page follows the theme; PDF figures use fixed print colors on white.
const PRINT_PAL={bg:'#fff',bars:'#b4bac0',diag:'#999',curve:'#d4452b',frame:'#888'};
function drawHist(c,h,lut,pal){
 const W=256,H=lut?256:110;c.width=W;c.height=H;const x=c.getContext('2d');
 if(pal.bg){x.fillStyle=pal.bg;x.fillRect(0,0,W,H)}else x.clearRect(0,0,W,H);
 const mx=Math.sqrt(Math.max(...h)||1);x.fillStyle=pal.bars;
 for(let i=0;i<256;i++){const bh=Math.sqrt(h[i])/mx*H*(lut?.9:.95);x.fillRect(i,H-bh,1,bh)}
 if(lut){x.strokeStyle=pal.diag;x.setLineDash([3,3]);x.beginPath();x.moveTo(0,H);x.lineTo(W,0);x.stroke();x.setLineDash([]);
  x.strokeStyle=pal.curve;x.lineWidth=2;x.beginPath();
  for(let r=0;r<256;r++){const y=H-lut[r]/255*H;r?x.lineTo(r,y):x.moveTo(r,y)}x.stroke()}
 if(pal.frame){x.strokeStyle=pal.frame;x.lineWidth=1;x.strokeRect(.5,.5,W-1,H-1)}
 return c}
function paintHist(c,h,lut){const st=getComputedStyle(document.documentElement);
 return drawHist(c,h,lut,{bars:st.getPropertyValue('--hist'),diag:'#8886',curve:st.getPropertyValue('--curve')})}
const printHist=(h,lut)=>drawHist(document.createElement('canvas'),h,lut,PRINT_PAL).toDataURL('image/png');
function redraw(s){drawSide();TABS[App.tab].paint(s)}
function update(s){compute(s);redraw(s);save()}
function render(){TABS[App.tab].render()}
function drawSide(){
 const sd=$('side');sd.innerHTML='';
 App.sessions.forEach((s,i)=>{
  const b=document.createElement('div');b.className='thumb'+(s===App.cur?' on':'');b.tabIndex=0;b.title='Session '+(i+1);
  const T=TABS[App.tab];if(T.thumb){const c=document.createElement('canvas');T.thumb(c,s);b.append(c)}else{if(!s.empty&&!s.nodes[0].out)compute(s);
  if(s.empty){b.append(mk('span','emp','empty'))}else{const c=document.createElement('canvas');paintImg(c,s,s.nodes[0].out);b.append(c)}}
  const x=document.createElement('button');x.className='x';x.textContent='×';x.title='Close session';
  x.onclick=e=>{e.stopPropagation();App.sessions=App.sessions.filter(q=>q!==s);idbDel(s.pid);if(App.cur===s)App.cur=App.sessions[App.sessions.length-1]||null;sync()};
  b.append(x);b.onclick=()=>{App.cur=s;sync()};
  b.onkeydown=e=>{if(e.key==='Enter'){App.cur=s;sync()}};sd.append(b)});
 const pl=mk('button','thumb add','+');pl.title='New empty session';pl.setAttribute('aria-label','New empty session');
 pl.onclick=()=>{const T=TABS[App.tab],s=T.newSession?T.newSession():{pid:uid(),w:0,h:0,rgba:null,empty:true,gray:$('gray').checked,nodes:[{id:0,root:true}]};App.sessions.push(s);App.cur=s;sync()};sd.append(pl);
}
function sync(){save();$('pdf').disabled=!App.cur||App.cur.empty;if(App.cur)$('gray').checked=App.cur.gray;render();if(App.cur)update(App.cur);else drawSide()}
async function addImage(blob){if(TABS[App.tab].noImages)return;
 const bmp=await createImageBitmap(blob),k=Math.min(1,1200/Math.max(bmp.width,bmp.height));
 const w=Math.round(bmp.width*k),h=Math.round(bmp.height*k),c=document.createElement('canvas');c.width=w;c.height=h;
 const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0,w,h);
 const rgba=x.getImageData(0,0,w,h).data;
 if(App.cur&&App.cur.empty){Object.assign(App.cur,{w,h,rgba,empty:false,gray:$('gray').checked});keep(c,App.cur.pid);sync();return}
 const s={pid:uid(),w,h,rgba,gray:$('gray').checked,nodes:[{id:0,root:true}]};
 App.sessions.push(s);App.cur=s;keep(c,s.pid);sync();
}
document.addEventListener('paste',e=>{const it=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));if(it){e.preventDefault();addImage(it.getAsFile())}});
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{e.preventDefault();const f=[...e.dataTransfer.files].find(f=>f.type.startsWith('image/'));if(f)addImage(f)});
$('pick').onclick=()=>$('file').click();
$('file').onchange=e=>{if(e.target.files[0])addImage(e.target.files[0]);e.target.value=''};
$('gray').onchange=e=>{if(App.cur){App.cur.gray=e.target.checked;render();update(App.cur)}};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>App.cur&&redraw(App.cur));
let dl=null;
(async()=>{try{dl=await window.claude?.use('downloads')}catch(e){}$('pdf').hidden=!window.jspdf})();
const clean=t=>t.replace('Δ','Delta').replace('γ','gamma').replace(/–/g,'-');
function imgUrl(s,d){const t=document.createElement('canvas');paintImg(t,s,d);const c=document.createElement('canvas');c.width=s.w;c.height=s.h;
 const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,s.w,s.h);x.drawImage(t,0,0);return c.toDataURL('image/jpeg',.92)}
function exportPdf(){const f=TABS[App.tab].exportPdf;return f&&f()}
const IC=p=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const SUN=IC('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),MOON=IC('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>');
let dark=matchMedia('(prefers-color-scheme: dark)').matches;
function setTheme(d){dark=d;document.documentElement.setAttribute('data-theme',d?'dark':'light');$('theme').innerHTML=d?SUN:MOON;
 try{localStorage.setItem('hl-theme',d?'dark':'light')}catch(e){}if(App.cur)redraw(App.cur)}
$('theme').onclick=()=>setTheme(!dark);
let sv=null;
try{sv=localStorage.getItem('hl-theme')}catch(e){}
setTheme(sv==='dark'||sv==='light'?sv==='dark':dark);
$('pdf').onclick=exportPdf;
const nodeName=n=>n.root?'Original':TR[n.type].n;
function mk(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
// Shared PDF scaffolding for the image tabs: A4 portrait, 12 mm margins, a title + subtitle header,
// page.need(h) starts a new page when h mm no longer fit, then save and report progress in the header status.
async function exportSessionPdf(title,fileStem,build){
 const s=App.cur,st=$('st');if(!s||s.empty||!window.jspdf)return;st.textContent='Building PDF…';
 try{
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),M=12;
  const page={doc,M,y:M,
   need(h){if(this.y+h>287){doc.addPage();this.y=M}},
   header(sub){doc.setFontSize(15);doc.setTextColor(30);doc.text(title,M,this.y+5);doc.setFontSize(9);doc.setTextColor(110);doc.text(sub,M,this.y+11);this.y+=18}};
  await build(page,s);
  await savePdf(doc,`${fileStem}-session-${App.sessions.indexOf(s)+1}.pdf`);st.textContent='';
 }catch(e){st.textContent=e&&e.code==='declined'?'':'Could not export the PDF.'}
}
async function savePdf(doc,name){
 const blob=doc.output('blob');
 if(dl){await dl.save({filename:name,data:blob});return}
 const f=new File([blob],name,{type:'application/pdf'});
 if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){
  try{await navigator.share({files:[f],title:name})}catch(e){if(e&&e.name!=='AbortError')throw e}
  return}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
document.querySelectorAll('.tabs button').forEach(bt=>bt.onclick=()=>{
 ST[App.tab]={sessions:App.sessions,cur:App.cur};App.tab=bt.dataset.tab;({sessions:App.sessions,cur:App.cur}=ST[App.tab]);document.body.dataset.tab=App.tab;
 document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',x===bt));
 sync()});
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
let dbp=null,saveT=0;
const db=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('hist-lab',1);r.onupgradeneeded=()=>r.result.createObjectStore('imgs');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
const idbOp=(mode,fn)=>db().then(d=>new Promise((res,rej)=>{const t=d.transaction('imgs',mode),q=fn(t.objectStore('imgs'));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)}));
const idbPut=(k,v)=>idbOp('readwrite',o=>o.put(v,k));
const idbGet=k=>idbOp('readonly',o=>o.get(k));
const idbDel=k=>{if(k)idbOp('readwrite',o=>o.delete(k)).catch(()=>{})};
const keep=(c,pid)=>c.toBlob(b=>{if(b)idbPut(pid,b).catch(()=>{})},'image/png');
function save(){
 clearTimeout(saveT);
 saveT=setTimeout(()=>{hTick();
  // the active tab's sessions live in sessions/cur; the others are parked in ST
  try{const per=Object.fromEntries(Object.keys(ST).map(t=>[t,t===App.tab?ser(App.sessions,App.cur):ser(ST[t].sessions,ST[t].cur)]));
   localStorage.setItem('hl-state',JSON.stringify({v:2,tab:App.tab,...per}))}catch(e){}},250)}
const ST={hist:{sessions:[],cur:null},bits:{sessions:[],cur:null},kern:{sessions:[],cur:null},otsu:{sessions:[],cur:null}};
const ser=(ss,c)=>({cur:c?c.pid:null,sessions:ss.map(s=>({pid:s.pid,w:s.w,h:s.h,empty:!!s.empty,k:s.k||null,ot:s.ot||null,gray:s.gray,
  nodes:s.nodes.map(n=>({id:n.id,parent:n.parent,type:n.type,v:n.v,root:n.root})),
  bits:s.bits?{src:s.bits.src,sel:[...s.bits.sel],norm:s.bits.norm}:null}))});
async function loadTab(d){
 const sessions=[];let mx=0;
 if(!d||!Array.isArray(d.sessions))return{sessions,cur:null,mx};
 for(const r of d.sessions){
  const s={pid:r.pid,w:r.w,h:r.h,gray:r.gray,empty:!!r.empty,rgba:null,nodes:r.nodes||[],k:r.k||undefined,ot:r.ot||undefined};
  if(r.bits)s.bits={src:r.bits.src,sel:new Set(r.bits.sel),norm:r.bits.norm};
  r.nodes.forEach(n=>{mx=Math.max(mx,n.id)});
  if(!s.empty&&!s.k){
   try{const blob=await idbGet(s.pid);if(!blob)continue;const bmp=await createImageBitmap(blob);
    const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0);
    s.rgba=x.getImageData(0,0,c.width,c.height).data;s.w=c.width;s.h=c.height}catch(e){continue}
  }
  sessions.push(s);
 }
 return{sessions,cur:sessions.find(s=>s.pid===d.cur)||sessions[sessions.length-1]||null,mx};
}
async function restore(){
 let raw=null;try{raw=JSON.parse(localStorage.getItem('hl-state'))}catch(e){}
 if(!raw)return;
 const h=await loadTab(raw.hist||(raw.sessions?raw:null)),b=await loadTab(raw.bits),kk=await loadTab(raw.kern),oo=await loadTab(raw.otsu);
 ST.hist=h;ST.bits=b;ST.kern=kk;ST.otsu=oo;App.nid=Math.max(App.nid,h.mx+1,b.mx+1);
 App.tab=['bits','kern','otsu'].includes(raw.tab)?raw.tab:'hist';document.body.dataset.tab=App.tab;
 document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',x.dataset.tab===App.tab));
 ({sessions:App.sessions,cur:App.cur}=ST[App.tab]);sync();
 idbOp('readwrite',o=>o.getAllKeys()).then(ks=>ks.forEach(k=>{
  if(![...App.sessions,...ST.hist.sessions,...ST.bits.sessions,...ST.kern.sessions,...ST.otsu.sessions].some(s=>s.pid===k))idbDel(k)})).catch(()=>{});
}
$('main').addEventListener('click',e=>{if(e.target.closest('.empty'))$('file').click()});
$('main').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('empty')){e.preventDefault();$('file').click()}});
function hSnap(s){if(!s)return null;
 return s.k?JSON.stringify({k:s.k},(key,val)=>(key==='done'||key==='sig'||key==='pos'||key==='placed'||key==='tw'||key==='tn')?undefined:val)
  :JSON.stringify({ot:s.ot||null,gray:s.gray,nodes:s.nodes.map(n=>({id:n.id,parent:n.parent,type:n.type,v:n.v,root:n.root})),bits:s.bits?{src:s.bits.src,sel:[...s.bits.sel],norm:s.bits.norm}:null})}
function hBtns(){const s=App.cur;$('undo').disabled=!(s&&s.hs&&s.hs.u.length);$('redo').disabled=!(s&&s.hs&&s.hs.r.length)}
function hTick(){const s=App.cur;if(!s)return;const sn=hSnap(s);
 if(!s.hs)s.hs={u:[],r:[],last:sn};
 else if(sn!==s.hs.last){s.hs.u.push(s.hs.last);if(s.hs.u.length>100)s.hs.u.shift();s.hs.r=[];s.hs.last=sn}
 hBtns()}
function hApply(s,snap){const d=JSON.parse(snap);
 if(s.k){const nk=d.k;(nk.steps||[]).forEach((st,i)=>{const o=s.k.steps&&s.k.steps[i];st.pos=o?o.pos:[0,0];st.placed=o?o.placed:false;st.done=[];st.sig=''});s.k=nk}
 else{s.ot=d.ot||undefined;s.gray=d.gray;s.nodes=d.nodes;s.bits=d.bits?{src:d.bits.src,sel:new Set(d.bits.sel),norm:d.bits.norm}:undefined}
 sync();s.hs.last=hSnap(s)}
function hUndo(){hTick();const s=App.cur;if(!s||!s.hs||!s.hs.u.length)return;const p=s.hs.u.pop();s.hs.r.push(s.hs.last);hApply(s,p);hBtns()}
function hRedo(){hTick();const s=App.cur;if(!s||!s.hs||!s.hs.r.length)return;const n=s.hs.r.pop();s.hs.u.push(s.hs.last);hApply(s,n);hBtns()}
$('undo').innerHTML=IC(`<path d='M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3'/>`);
$('redo').innerHTML=IC(`<path d='M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3'/>`);
$('undo').onclick=hUndo;
$('redo').onclick=hRedo;
document.addEventListener('keydown',e=>{const t=e.target,txt=t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&!['range','checkbox','button'].includes(t.type));
 if(txt||!(e.ctrlKey||e.metaKey))return;const k=e.key.toLowerCase();
 if(k==='z'&&!e.shiftKey){e.preventDefault();hUndo()}else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();hRedo()}});
document.addEventListener('click',()=>document.querySelectorAll('.menu').forEach(z=>z.hidden=true));
return{$,addImage,clean,drawSide,emptyState,exportSessionPdf,IC,imgUrl,mk,nodeName,paintHist,paintImg,printHist,registerTab,
 render,restore,save,sync,uid,update};
})();
