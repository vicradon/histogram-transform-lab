/* ==== 4. TAB: Bit-plane slicing ======================================================================= */
const BitsTab=(()=>{
const{bitLut,lumLut,maskLut}=Algos;
const{$,clean,emptyState,exportSessionPdf,imgUrl,mk,nodeName,paintHist,paintImg,printHist,registerTab,save}=Core;

let bitsEl=null;
function bitsState(){const s=App.cur;if(!s.bits)s.bits={src:0,sel:new Set([8,7]),norm:true};if(!s.nodes.some(n=>n.id===s.bits.src))s.bits.src=0;return s.bits}
function tog(k){const x=App.cur.bits.sel;x.has(k)?x.delete(k):x.add(k);paintBits()}
function renderBits(){
 const m=$('main');m.innerHTML='';bitsEl=null;
 if(emptyState(m,'Click to choose a file (or paste one), then slice it into bit planes here.'))return;
 const s=App.cur,b=bitsState(),E=bitsEl={planes:{},chips:{}};
 const c1=mk('section','card','<h2>Source and group</h2>'),r1=mk('div','row');
 const sc=mk('div','col');sc.style.minWidth='220px';if(s.nodes.length>1)sc.append(mk('label','cap','Slice this image'));
 const sel=mk('select');sel.innerHTML=s.nodes.map(n=>`<option value='${n.id}'>#${n.id} ${nodeName(n)}</option>`).join('');sel.value=b.src;
 sel.onchange=()=>{b.src=+sel.value;paintBits()};if(s.nodes.length>1)sc.append(sel);
 const nl=mk('label','sw',"<input type='checkbox'> Rescale group to full range");nl.firstChild.checked=b.norm;
 nl.firstChild.onchange=e=>{b.norm=e.target.checked;paintBits()};sc.append(nl);
 const gc=mk('div','col');gc.append(mk('div','cap','Group planes (8 = MSB, 1 = LSB)'));
 const chips=mk('div','chips');
 for(let k=8;k>=1;k--){const ch=mk('button','chip',k);ch.onclick=()=>tog(k);E.chips[k]=ch;chips.append(ch)}
 const pre=mk('div','chips');
 [['MSB only',[8]],['8 + 7',[8,7]],['8 to 6',[8,7,6]],['8 to 5',[8,7,6,5]],['All',[1,2,3,4,5,6,7,8]],['Clear',[]]].forEach(([l,a])=>{const x=mk('button','',l);x.onclick=()=>{b.sel=new Set(a);paintBits()};pre.append(x)});
 gc.append(chips,pre);r1.append(sc,gc);c1.append(r1);
 const gr=mk('div','row');gr.style.marginTop='12px';
 const gi=mk('div','col');E.gimg=mk('canvas','v img');gi.append(E.gimg);
 const gv2=mk('div','col');gv2.style.width='240px';E.gcurve=mk('canvas','v');E.gtxt=mk('div','cap');gv2.append(E.gcurve,E.gtxt);
 gr.append(gi,gv2);c1.append(gr);m.append(c1);
 const g=mk('div','bgrid');
 const tile=k=>{
  const t=mk('section','card');
  const h=mk('h2','',k?`Bit plane ${k}${k===8?' (MSB)':k===1?' (LSB)':''}`:'Source image');
  const P=E.planes[k]={};
  if(k){h.append(mk('span','sp'));const lb=mk('label','sw',"<input type='checkbox'> <span class='cap'>In group</span>");lb.firstChild.onchange=()=>tog(k);P.cb=lb.firstChild;h.append(lb)}
  const r=mk('div','row2');P.img=mk('canvas','v img');P.curve=mk('canvas','v');r.append(P.img,P.curve);t.append(h,r);
  t.append(mk('div','cap',k?`T(r) = 255 when bit ${k} of r is 1, else 0 (period ${2**k} levels)`:'T(r) = r (identity)'));g.append(t)};
 [0,1,2,3,4,5,6,7,8].forEach(tile);m.append(g);
}
function paintBits(){
 const s=App.cur,E=bitsEl;if(!s||!E||App.tab!=='bits')return;save();
 const b=bitsState(),n=s.nodes.find(x=>x.id===b.src),idl=new Uint8Array(256).map((_,i)=>i);
 paintImg(E.planes[0].img,s,n.out);paintHist(E.planes[0].curve,n.h,idl);
 for(let k=1;k<=8;k++){const l=bitLut(k),p=E.planes[k];paintImg(p.img,s,lumLut(n.out,l));paintHist(p.curve,n.h,l);
  p.cb.checked=b.sel.has(k);E.chips[k].setAttribute('aria-pressed',b.sel.has(k))}
 let m=0;b.sel.forEach(k=>m|=1<<(k-1));const gl=maskLut(m,b.norm);
 paintImg(E.gimg,s,lumLut(n.out,gl));paintHist(E.gcurve,n.h,gl);
 const ks=[...b.sel].sort((a,c)=>c-a);
 E.gtxt.textContent=m?`Planes ${ks.join(' + ')}: T(r) = r AND ${m} (${m.toString(2).padStart(8,'0')})${b.norm?', rescaled by 255/'+m:''}`:'Select at least one plane to see the group result.';
}
function exportBitsPdf(){return exportSessionPdf('Bit-plane slicing','bitplanes',(P,s)=>{const{doc,M}=P,RH=60;
 const b=bitsState(),n=s.nodes.find(x=>x.id===b.src),idl=new Uint8Array(256).map((_,i)=>i);
 P.header(`Session ${App.sessions.indexOf(s)+1}, source #${n.id} ${clean(nodeName(n))}, ${s.w} x ${s.h} px, ${new Date().toLocaleDateString()}`);
 const k=Math.min(44/s.w,44/s.h),iw=s.w*k,ih=s.h*k;
 const tile=(x,y,title,cap,d,lut)=>{doc.setFontSize(10);doc.setTextColor(30);doc.text(title,x,y+4);
  doc.addImage(imgUrl(s,d),'JPEG',x,y+7,iw,ih);doc.addImage(printHist(n.h,lut),'PNG',x+46,y+7,44,44);
  doc.setFontSize(7);doc.setTextColor(120);doc.text(doc.splitTextToSize(cap,90),x,y+55)};
 const items=[['Source image','T(r) = r (identity)',n.out,idl]];
 for(let p=1;p<=8;p++){const l=bitLut(p);items.push([`Bit plane ${p}${p===8?' (MSB)':p===1?' (LSB)':''}`,`T(r) = 255 if bit ${p} of r is 1, else 0 (period ${2**p} levels)`,lumLut(n.out,l),l])}
 // two tiles per row
 items.forEach((it,i)=>{const col=i%2;if(!col){if(i)P.y+=RH;P.need(RH)}tile(M+col*94,P.y,...it)});
 P.y+=RH;P.need(RH);
 let m=0;b.sel.forEach(q=>m|=1<<(q-1));
 if(m){const gl=maskLut(m,b.norm),ks=[...b.sel].sort((a,c)=>c-a);
  tile(M,P.y,'Group: planes '+ks.join(' + '),`T(r) = r AND ${m} (${m.toString(2).padStart(8,'0')})${b.norm?', rescaled by 255/'+m:', not rescaled'}`,lumLut(n.out,gl),gl)}
 else{doc.setFontSize(9);doc.setTextColor(110);doc.text('No bit planes selected for grouping.',M,P.y+4)}})}
const hooks={render:renderBits,paint:()=>paintBits(),exportPdf:exportBitsPdf};
registerTab('bits',hooks);
return hooks;
})();
