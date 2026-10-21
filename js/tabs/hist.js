/* ==== 3. TAB: Histogram transforms ==================================================================== */
const HistTab=(()=>{
const{applyLut,gv,lutOf,TR}=Algos;
const{$,clean,emptyState,exportSessionPdf,imgUrl,paintHist,paintImg,printHist,registerTab,render,update}=Core;

function paintHistTab(s){
 s.nodes.forEach(n=>{
  if(!n.el)return;paintImg(n.el.img,s,n.out);paintHist(n.el.oh,n.h,null);
  if(!n.root)paintHist(n.el.curve,n.inH,n.lut);
 });
}
function nodeCard(s,n,depth){
 const t=n.root?null:TR[n.type];
 const card=document.createElement('section');card.className='card';card.style.marginLeft=Math.min(depth,6)*18+'px';
 const par=n.root?'':` <span class="mut">from #${n.parent}</span>`;
 card.innerHTML=`<h2>#${n.id} ${n.root?(s.gray?'Original (grayscale)':'Original (color)'):t.n}${par}<span class="sp"></span>${n.root?'':'<button data-del>Remove</button>'}</h2><div class="row"></div>`;
 const row=card.querySelector('.row'),el={};n.el=el;
 if(!n.root){
  const c=document.createElement('div');c.className='col';c.style.width='280px';
  el.curve=document.createElement('canvas');el.curve.className='v';c.append(el.curve);
  const cap=document.createElement('div');cap.className='cap';cap.textContent='Input histogram (sqrt scale) with T(r) curve';c.append(cap);
  t.p.forEach(([k,lab,mn,mx,stp,,lg,opts])=>{
   const d=document.createElement('div');d.className='ctl';
   if(lg==='sel'){d.innerHTML=`<span>${lab}</span><select style="grid-column:2/4">${opts.map((o,i)=>`<option value="${i}">${o}</option>`).join('')}</select>`;
    const se=d.querySelector('select');se.value=n.v[k];se.onchange=()=>{n.v[k]=+se.value;update(s)};c.append(d);return}
   d.innerHTML=`<span>${lab}</span><input type="range" min="${mn}" max="${mx}" step="${stp}" value="${n.v[k]}"><output></output>`;
   const inp=d.querySelector('input'),o=d.querySelector('output');
   const show=()=>o.textContent=lg==='log'?gv(+inp.value).toFixed(2):inp.value;show();
   inp.oninput=()=>{n.v[k]=+inp.value;show();update(s)};c.append(d)});
  row.append(c);
 }
 const ic=document.createElement('div');ic.className='col';
 el.img=document.createElement('canvas');el.img.className='v img';ic.append(el.img);row.append(ic);
 const hc=document.createElement('div');hc.className='col';hc.style.width='256px';
 el.oh=document.createElement('canvas');el.oh.className='v';hc.append(el.oh);
 const hcap=document.createElement('div');hcap.className='cap';hcap.textContent=n.root?'Histogram':'Resulting histogram';hc.append(hcap);row.append(hc);
 const sel=document.createElement('button');sel.className='add';sel.textContent='Apply transform ▾';
 sel.onclick=()=>openPicker(s,n,card);
 card.append(sel);
 const del=card.querySelector('[data-del]');
 if(del)del.onclick=()=>{const rm=new Set([n.id]);let ch=true;while(ch){ch=false;s.nodes.forEach(x=>{if(!rm.has(x.id)&&rm.has(x.parent)){rm.add(x.id);ch=true}})}
  s.nodes=s.nodes.filter(x=>!rm.has(x.id));render();update(s)};
 return card;
}
function openPicker(s,n,card){
 let p=card.querySelector('.picker');if(p){p.remove();return}
 p=document.createElement('div');p.className='picker';
 const sc=document.createElement('canvas');paintImg(sc,s,n.out);
 const k=Math.min(1,96/Math.max(s.w,s.h)),tw=Math.max(1,Math.round(s.w*k)),th=Math.max(1,Math.round(s.h*k));
 const tc=document.createElement('canvas');tc.width=tw;tc.height=th;const tx=tc.getContext('2d',{willReadFrequently:true});
 tx.drawImage(sc,0,0,tw,th);const sd=tx.getImageData(0,0,tw,th).data;
 Object.entries(TR).forEach(([type,t])=>{
  const v={};t.p.forEach(q=>v[q[0]]=q[5]);const lut=lutOf({type,v,inH:n.h});
  const b=document.createElement('button');b.className='tile';b.title='Add '+t.n;
  const cv=document.createElement('canvas');cv.className='c';paintHist(cv,n.h,lut);
  const im=document.createElement('canvas');im.className='r';im.width=tw;im.height=th;
  im.getContext('2d').putImageData(new ImageData(applyLut(sd,lut),tw,th),0,0);
  const lb=document.createElement('span');lb.textContent=t.n;b.append(cv,im,lb);
  b.onclick=()=>{s.nodes.push({id:App.nid++,parent:n.id,type,v});render();update(s);
   s.nodes[s.nodes.length-1].el.img.scrollIntoView({block:'nearest',behavior:'smooth'})};
  p.append(b)});
 card.append(p);
}
function renderHist(){
 const m=$('main');m.innerHTML='';
 if(emptyState(m,'Click to choose a file, or press Ctrl/Cmd+V anywhere on this page, drop a file, or use “Open image…”.<br>Each new image opens its own session.'))return;
 const depth=id=>{const n=App.cur.nodes.find(x=>x.id===id);return n.root?0:1+depth(n.parent)};
 // depth-first order so children sit under parents
 const order=[],walk=id=>{order.push(App.cur.nodes.find(x=>x.id===id));App.cur.nodes.filter(x=>x.parent===id).forEach(c=>walk(c.id))};walk(0);
 order.forEach(n=>m.append(nodeCard(App.cur,n,depth(n.id))));
}
function pstr(n){return TR[n.type].p.map(([k,l,,,,,lg,o])=>clean(l)+'='+(lg==='sel'?o[n.v[k]]:lg==='log'?gv(n.v[k]).toFixed(2):n.v[k])).join(', ')}
function exportHistPdf(){return exportSessionPdf('Histogram transform lab','histogram',(P,s)=>{const{doc,M}=P,BH=70;
 P.header(`Session ${App.sessions.indexOf(s)+1}: ${s.w} x ${s.h} px, ${s.gray?'grayscale (RGB to gray)':'color'}, ${new Date().toLocaleDateString()}`);
 const order=[],walk=id=>{order.push(s.nodes.find(x=>x.id===id));s.nodes.filter(x=>x.parent===id).forEach(c=>walk(c.id))};walk(0);
 for(const n of order){
  P.need(BH);const y=P.y;
  const name=n.root?'Original':clean(TR[n.type].n);
  doc.setFontSize(10);doc.setTextColor(30);doc.text(`#${n.id} ${name}${n.root?'':' (from #'+n.parent+')'}`,M,y+4);
  if(!n.root){doc.setFontSize(8);doc.setTextColor(110);doc.text(pstr(n),M,y+9)}
  let x=M;const ty=y+12;doc.setFontSize(7);doc.setTextColor(120);
  if(!n.root){doc.addImage(printHist(n.inH,n.lut),'PNG',x,ty,52,52);doc.text('Input histogram + T(r)',x,ty+55);x+=56}
  const k=Math.min(70/s.w,52/s.h),iw=s.w*k,ih=s.h*k;
  doc.addImage(imgUrl(s,n.out),'JPEG',x,ty,iw,ih);x+=74;
  doc.addImage(printHist(n.h,null),'PNG',x,ty,52,52*110/256);doc.text('Resulting histogram',x,ty+52*110/256+3);
  P.y+=BH;
 }})}
const hooks={render:renderHist,paint:paintHistTab,exportPdf:exportHistPdf};
registerTab('hist',hooks);
return hooks;
})();
