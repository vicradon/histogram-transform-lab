/* ==== 5. TAB: Kernels & morphology ==================================================================== */
const KernTab=(()=>{
const{kalg,kBin,kbox,kcells,kCl,kEff,kFlat,kFmt,kGrid,kimg,kIn,klab,kNum,kout,kraster,kSI,kSP,kWithEdits,kwt}=Algos;
const{$,drawSide,IC,mk,registerTab,save,uid}=Core;

const KP=[['4-conn cross',[[-1,1,-1],[1,1,1],[-1,1,-1]]],['8-conn square',[[1,1,1],[1,1,1],[1,1,1]]],['Horizontal',[[-1,-1,-1],[1,1,1],[-1,-1,-1]]],['Vertical',[[-1,1,-1],[-1,1,-1],[-1,1,-1]]],['Corner NW',[[0,0,-1],[0,1,1],[-1,1,-1]]],['Corner SE',[[-1,1,-1],[1,1,0],[-1,0,0]]]];
const KOPS=[['erode','Erosion'],['dilate','Dilation'],['hm','Hit-or-miss'],['alg','Algebra'],['wt','Weighted min/max-plus (sequential)'],['label','Sequential labeling'],['apply','Relabel through table']];
let kE=null;
// transient kernels-tab UI state (never saved): active step, selected shapes, shape being drawn, whether a drag is in progress
const kui={act:0,sel:new Set(),draft:null,dragging:false};
// Whole-image mode (js/tabs/kern-image.js) plugs in here; sessions made from an image have k.src === 'image'.
let imageMode=null;
const isImg=s=>!!(s&&s.k&&s.k.src==='image');
function setImageMode(m){imageMode=m}
function newKern(){return{pid:uid(),w:0,h:0,rgba:null,gray:true,nodes:[],k:{shapes:[],nx:1,ng:1,view:'drawing',op:'erode',conn:8,tool:'rect',fill:true,K:KP[1][1].map(r=>r.slice()),pos:[0,0]}}}
function kCell(G,x,i,fill,txt,tc){const{C:KC,W:KW}=G;const X=(i%KW)*KC,Y=((i/KW)|0)*KC;x.fillStyle=fill;x.fillRect(X,Y,KC,KC);x.strokeStyle='#cfcfcf';x.lineWidth=1;x.strokeRect(X+.5,Y+.5,KC-1,KC-1);
 if(txt!==''){x.fillStyle=tc;x.fillText(txt,X+KC/2,Y+KC/2+1)}}
function kDraw(G,x,sh){const{C:KC}=G;const hue=sh.id*57%360;x.fillStyle=`hsl(${hue},60%,75%)`;x.strokeStyle=`hsl(${hue},50%,35%)`;x.lineWidth=2;x.lineCap=x.lineJoin='round';
 if(sh.t==='free'){x.beginPath();sh.pts.forEach((p,i)=>x[i?'lineTo':'moveTo']((p[0]+.5)*KC,(p[1]+.5)*KC));if(sh.pts.length===1)x.lineTo((sh.pts[0][0]+.5)*KC+.1,(sh.pts[0][1]+.5)*KC);x.lineWidth=KC*.7;x.strokeStyle=`hsl(${hue},50%,45%)`;x.stroke();return}
 const[a,b,c,d]=kbox(sh),X=a*KC,Y=b*KC,w=(c-a+1)*KC,h=(d-b+1)*KC;x.beginPath();
 if(sh.t==='rect')x.rect(X,Y,w,h);else if(sh.t==='ellipse')x.ellipse(X+w/2,Y+h/2,w/2,h/2,0,0,7);
 else{x.moveTo(X+w/2,Y);x.lineTo(X+w,Y+h/2);x.lineTo(X+w/2,Y+h);x.lineTo(X,Y+h/2);x.closePath()}
 if(sh.fill)x.fill();x.stroke()}
function kSelBox(G,x,k,acc){const{C:KC}=G;x.save();x.strokeStyle=acc;x.lineWidth=2;const gs=new Set();
 k.shapes.forEach(sh=>{if(!kui.sel.has(sh.id))return;x.setLineDash([4,3]);const b=kbox(sh);x.strokeRect(b[0]*KC-1,b[1]*KC-1,(b[2]-b[0]+1)*KC+2,(b[3]-b[1]+1)*KC+2);if(sh.g)gs.add(sh.g)});
 gs.forEach(id=>{const bs=k.shapes.filter(s=>s.g===id).map(kbox),a=Math.min(...bs.map(b=>b[0])),b=Math.min(...bs.map(q=>q[1])),c=Math.max(...bs.map(q=>q[2])),d=Math.max(...bs.map(q=>q[3]));
  x.setLineDash([10,4]);x.strokeRect(a*KC-4,b*KC-4,(c-a+1)*KC+8,(d-b+1)*KC+8)});x.restore()}
function kKernel(G,x,k,acc,crv){const{C:KC}=G;const K=k.K,n=K.length,r=n>>1,[px,py]=k.pos;x.save();x.lineWidth=2;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const v=K[j][i],X=(px+i-r)*KC,Y=(py+j-r)*KC;
  if(v<0){x.setLineDash([3,3]);x.strokeStyle='#888';x.strokeRect(X+1,Y+1,KC-2,KC-2);continue}
  x.setLineDash([]);x.fillStyle=(v?acc:crv)+'66';x.fillRect(X,Y,KC,KC);x.strokeStyle=v?acc:crv;x.strokeRect(X+1,Y+1,KC-2,KC-2);x.fillStyle='#000';x.fillText(v,X+KC/2,Y+KC/2+1)}
 x.setLineDash([]);x.lineWidth=2;x.strokeStyle='#000';x.strokeRect((px-r)*KC,(py-r)*KC,n*KC,n*KC);x.lineWidth=3;x.strokeStyle='#000';x.strokeRect(px*KC+2,py*KC+2,KC-4,KC-4);x.restore()}
const KI={select:`<path d='M5 3l14 7-6 2-2 6z'/>`,rect:`<rect x='4' y='6' width='16' height='12'/>`,ellipse:`<ellipse cx='12' cy='12' rx='8' ry='6'/>`,diamond:`<path d='M12 3l9 9-9 9-9-9z'/>`,free:`<path d='M3 17c3-8 5-8 8-2s5 4 10-8'/>`,
 group:`<rect x='3' y='3' width='11' height='11' stroke-dasharray='2 2'/><rect x='10' y='10' width='11' height='11'/>`,ungroup:`<rect x='3' y='3' width='8' height='8'/><rect x='13' y='13' width='8' height='8'/>`,del:`<path d='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'/>`};
const KT=[['select','Select / move','V',KI.select],['rect','Rectangle','R',KI.rect],['ellipse','Ellipse','O',KI.ellipse],['diamond','Diamond','D',KI.diamond],['free','Line (freehand)','L',KI.free]];
function kGroup(){const k=App.cur.k,sel=k.shapes.filter(q=>kui.sel.has(q.id));if(sel.length>1){const id=k.ng++;sel.forEach(q=>q.g=id)}}
function kUngroup(){App.cur.k.shapes.forEach(q=>{if(kui.sel.has(q.id))q.g=0})}
function kDelete(){const k=App.cur.k;k.shapes=k.shapes.filter(q=>!kui.sel.has(q.id));kui.sel.clear()}
const KCUR={};
function kCur(t){if(KCUR[t])return KCUR[t];
 const st="fill='none' stroke='black' stroke-width='1.5'",
  g={rect:`<rect x='13' y='14' width='10' height='7' ${st}/>`,ellipse:`<ellipse cx='18' cy='17.5' rx='5' ry='4' ${st}/>`,diamond:`<path d='M18 12l5 5.5-5 5.5-5-5.5z' ${st}/>`,free:`<path d='M12 22c2-7 3 2 5-3s3 0 5-4' ${st}/>`}[t]||'',
  svg=`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M7 1v12M1 7h12' stroke='white' stroke-width='3.2'/><path d='M7 1v12M1 7h12' stroke='black' stroke-width='1.2'/>${g}</svg>`;
 return KCUR[t]=`url("data:image/svg+xml,${encodeURIComponent(svg)}") 7 7, crosshair`}
document.addEventListener('keydown',e=>{if(App.tab!=='kern'||!App.cur||!App.cur.k||isImg(App.cur)||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 const d={ArrowRight:'r',ArrowLeft:'l',ArrowUp:'u',ArrowDown:'d'}[e.key];if(d){e.preventDefault();kMove(d);return}
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const T={v:'select',r:'rect',o:'ellipse',d:'diamond',l:'free',p:'paint'}[e.key.toLowerCase()];
 if(T&&!e.shiftKey){App.cur.k.tool=T;App.cur.k.view='drawing';kPaint();return}
 if(e.key==='g'){kGroup();kPaint()}else if(e.key==='G'){kUngroup();kPaint()}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();kDelete();kPaint()}});
KI.paint=`<rect x='4' y='4' width='7' height='7' fill='currentColor'/><rect x='13' y='13' width='7' height='7'/><path d='M13 4h7v7h-7z' stroke-dasharray='2 2'/>`;
function kMig(k){if(!k.W){k.W=12;k.H=12}if(!k.px)k.px={};
 if(!k.steps)k.steps=[{op:k.op||'erode',conn:k.conn||8,K:k.K||KP[1][1].map(r=>r.slice()),pos:k.pos||[0,0],placed:!!k.placed,done:[],sig:''}];
 }
function kPx(G,k,p,er){const{W:KW}=G;const key=p[0]+','+p[1];if(!er)k.px[key]=1;else if(kraster(G,k)[p[1]*KW+p[0]])k.px[key]=-1;else delete k.px[key]}
function kThumb(c,s){kMig(s.k);const G=kGrid(s.k);c.width=G.W;c.height=G.H;const g=kimg(G,s.k),d=new Uint8ClampedArray(g.length*4);
 for(let i=0;i<g.length;i++){const v=g[i]?30:250;d[i*4]=d[i*4+1]=d[i*4+2]=v;d[i*4+3]=255}
 c.getContext('2d').putImageData(new ImageData(d,G.W,G.H),0,0)}
function renderKern(){
 const m=$('main');m.innerHTML='';kE=null;kui.sel.clear();
 if(!App.cur){App.cur=newKern();App.sessions.push(App.cur)}
 if(isImg(App.cur))return imageMode.render();
 const k=App.cur.k;kMig(k);const E=kE={steps:[]};
 const c1=mk('section','card');c1.append(mk('h2','','Drawing tools'),mk('div','cap','Draw a small binary image and step a kernel across it. To run the same operations on a whole picture, paste, drop or open an image here.'));
 const r1=mk('div','row'),tl=mk('div','chips');E.tools={};
 [...KT,['paint','Paint 1s (Shift or right-drag erases)','P',KI.paint]].forEach(([t,l,key,ic])=>{const b=mk('button','chip ibtn',IC(ic));b.title=`${l} (${key})`;b.setAttribute('aria-label',l);b.onclick=()=>{k.tool=t;if(t!=='paint')k.view='drawing';kPaint()};E.tools[t]=b;tl.append(b)});
 const fl=mk('label','sw',"<input type='checkbox'> Fill shapes");E.fill=fl.firstChild;
 E.fill.onchange=e=>{k.fill=e.target.checked;k.shapes.forEach(sh=>{if(kui.sel.has(sh.id)&&sh.t!=='free')sh.fill=k.fill});kPaint()};
 const gz=mk('label','sw',"Grid <input type='number' min='4' max='32'> x <input type='number' min='4' max='32'>"),gi=gz.querySelectorAll('input');E.gw=gi[0];E.gh=gi[1];
 E.gw.onchange=E.gh.onchange=()=>{k.W=kCl(+E.gw.value||12,4,32);k.H=kCl(+E.gh.value||12,4,32);kPaint()};
 const act=(l,f)=>{const b=mk('button','',l);b.onclick=()=>{f();kPaint()};return b},ac=mk('div','chips');
 const ia=(l,key,ic,f)=>{const b=mk('button','ibtn',IC(ic));b.title=`${l} (${key})`;b.setAttribute('aria-label',l);b.onclick=()=>{f();kPaint()};return b};
 ac.append(ia('Group','G',KI.group,kGroup),ia('Ungroup','Shift+G',KI.ungroup,kUngroup),ia('Delete','Del',KI.del,kDelete),act('Clear all',()=>{k.shapes=[];k.px={};kui.sel.clear()}));
 r1.append(tl,fl,gz,ac);c1.append(r1);m.append(c1);
 k.steps.forEach((st,i)=>m.append(kStepCard(E,k,st,i)));
 kui.act=Math.min(kui.act,k.steps.length-1);
}
function kSvg(K,c,dig){const n=K.length,r=n>>1;let s=`<svg width='${n*c}' height='${n*c}' viewBox='0 0 ${n*c} ${n*c}' style='display:block'>`;
 K.forEach((row,j)=>row.forEach((v,i)=>{const x=i*c,y=j*c,a=`x='${x+1}' y='${y+1}' width='${c-2}' height='${c-2}' data-i='${i}' data-j='${j}' pointer-events='all'`;
  s+=v<0?`<rect ${a} fill='none' stroke='var(--mut)' stroke-dasharray='2 2'/>`:`<rect ${a} rx='2' fill='${v?'var(--acc)':'var(--curve)'}'/>`;
  if(dig&&v>=0)s+=`<text x='${x+c/2}' y='${y+c/2+1}' text-anchor='middle' dominant-baseline='middle' font-size='${c*.45}' font-family='monospace' font-weight='600' fill='var(--bg)' pointer-events='none'>${v}</text>`}));
 return s+`<rect x='${r*c+3}' y='${r*c+3}' width='${c-6}' height='${c-6}' fill='none' stroke='var(--ink)' stroke-width='2' pointer-events='none'/></svg>`}
function kEd(E,k){const hm=k.op==='hm',V=hm?k.K:k.K.map(r=>r.map(v=>v===0?-1:v));E.ked.innerHTML=kSvg(V,32,true);
 E.ked.querySelectorAll('rect[data-i]').forEach(r=>r.onclick=()=>{const i=+r.dataset.i,j=+r.dataset.j,v=V[j][i];k.K[j][i]=hm?(v===1?0:v===0?-1:1):(v===1?-1:1);kEd(E,k);kPaint()})}
function kFixWt(st){if(!st.Wt)st.Wt=[[null,1,null],[1,0,null],[null,null,null]];if(!st.red)st.red='min';if(st.seq==null)st.seq=true;if(!st.dx)st.dx='lr';if(!st.dy)st.dy='tb'}
const KPW=[['V4 forward',[[null,1,null],[1,0,null],[null,null,null]],'lr','tb'],['V4 backward',[[null,null,null],[null,0,1],[null,1,null]],'rl','bt'],['V8 forward',[[1,1,1],[1,0,null],[null,null,null]],'lr','tb'],['V8 backward',[[null,null,null],[null,0,1],[1,1,1]],'rl','bt']];
function kNumCell(G,x,j,v,mx){const fin=isFinite(v);kCell(G,x,j,v===0?'#fff':!fin?'#cfd8e3':`hsl(195,65%,${88-48*Math.max(0,Math.min(v/mx,1))}%)`,kFmt(v),'#123')}
function kDrawVals(G,x,vals,mut,nums){const bin=vals.every(v=>v===0||v===1);let mx=1;if(!bin)vals.forEach(v=>{if(isFinite(v)&&v>mx)mx=v});
 for(let j=0;j<vals.length;j++){const v=vals[j];x.globalAlpha=mut&&mut(j)?.4:1;
  if(bin)kCell(G,x,j,v?'#222':'#fff',nums?v:'',v?'#fff':'#999');else kNumCell(G,x,j,v,mx)}
 x.globalAlpha=1}
function kKernelW(G,x,st,acc){const{C:KC}=G;const n=st.Wt.length,r=n>>1,[px,py]=st.pos,cs=kSI(G,st,px,py);x.save();x.lineWidth=2;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const w=st.Wt[j][i],xx=px+i-r,yy=py+j-r,X=xx*KC,Y=yy*KC;
  if(w==null){x.setLineDash([3,3]);x.strokeStyle='#888';x.strokeRect(X+1,Y+1,KC-2,KC-2);x.fillStyle='#888';x.fillText('∞',X+KC/2,Y+KC/2+1);continue}
  const upd=st.seq&&kIn(G,xx,yy)&&kSI(G,st,xx,yy)<cs;x.setLineDash([]);x.fillStyle=upd?acc+'88':'#9993';x.fillRect(X,Y,KC,KC);x.strokeStyle=upd?acc:'#777';x.strokeRect(X+1,Y+1,KC-2,KC-2);x.fillStyle='#000';x.fillText(kFmt(w),X+KC/2,Y+KC/2+1)}
 x.setLineDash([]);x.strokeStyle='#000';x.lineWidth=2;x.strokeRect((px-r)*KC,(py-r)*KC,n*KC,n*KC);x.lineWidth=3;x.strokeRect(px*KC+2,py*KC+2,KC-4,KC-4);x.restore()}
function kSvgW(Wt,c){const n=Wt.length,r=n>>1;let s=`<svg width='${n*c}' height='${n*c}' viewBox='0 0 ${n*c} ${n*c}' style='display:block'>`;
 Wt.forEach((row,j)=>row.forEach((w,i)=>{const x=i*c,y=j*c,a=`x='${x+1}' y='${y+1}' width='${c-2}' height='${c-2}'`,t=`x='${x+c/2}' y='${y+c/2+1}' text-anchor='middle' dominant-baseline='middle' font-size='${c*.55}' font-family='monospace' font-weight='700'`;
  s+=w==null?`<rect ${a} fill='none' stroke='var(--mut)' stroke-dasharray='2 2'/><text ${t} fill='var(--mut)'>∞</text>`:`<rect ${a} rx='2' fill='var(--acc)'/><text ${t} fill='var(--bg)'>${kFmt(w)}</text>`}));
 return s+`<rect x='${r*c+3}' y='${r*c+3}' width='${c-6}' height='${c-6}' fill='none' stroke='var(--ink)' stroke-width='2'/></svg>`}
function kWed(Es,st){const n=st.Wt.length,ex=st.red==='max'?'-∞':'∞';Es.wed.innerHTML='';Es.wed.style.gridTemplateColumns=`repeat(${n},46px)`;
 st.Wt.forEach((row,j)=>row.forEach((w,i)=>{const e=document.createElement('input');e.type='text';e.oninput=()=>kInf(e);e.value=w==null?ex:kFmt(w);
  e.style.cssText='width:46px;height:46px;box-sizing:border-box;text-align:center;font:600 13px monospace;padding:0;'+(j===n>>1&&i===n>>1?'border-color:var(--acc)':'');
  e.onchange=()=>{const t=e.value.trim();st.Wt[j][i]=(t===''||/inf|∞/i.test(t)||isNaN(+t))?null:+t;e.value=st.Wt[j][i]==null?ex:kFmt(st.Wt[j][i]);kPaint()};Es.wed.append(e)}))}
function kWSync(Es,st){Es.red.value=st.red;Es.dx.value=st.dx;Es.dy.value=st.dy;Es.wsz.value=st.Wt.length;kWed(Es,st)}
function kApplyW(st,pi){const[,Wt,dx,dy]=KPW[pi];st.Wt=Wt.map(r=>r.slice());st.dx=dx;st.dy=dy;st.red='min';st.seq=true;st.op='wt'}
function kMove(d,i){const k=App.cur.k;kMig(k);const G=kGrid(k),{W:KW,H:KH}=G;if(i==null)i=Math.min(kui.act,k.steps.length-1);kui.act=i;const st=k.steps[i];kFixWt(st);let[x,y]=st.pos;st.moved=true;
 if(st.op==='label'){const atEnd=st.placed&&y*KW+x===KW*KH-1;
  if(d==='r'&&atEnd&&(st.tw||0)<(st.tn||0)){st.tw=(st.tw||0)+1;kPaint();return}
  if(d==='l'&&(st.tw||0)>0){st.tw--;kPaint();return}}
 if(st.op==='wt'){if(d==='u'||d==='d')return;const fwd=(st.dx==='lr')===(d==='r');st.pos=kSP(G,st,kCl(kSI(G,st,x,y)+(fwd?1:-1),0,KW*KH-1));st.placed=true;kPaint();return}
 if(d==='r'){x++;if(x>=KW){x=0;y++}if(y>=KH){x=KW-1;y=KH-1}}
 else if(d==='l'){x--;if(x<0){x=KW-1;y--}if(y<0){x=0;y=0}}
 else if(d==='u')y=Math.max(0,y-1);else y=Math.min(KH-1,y+1);
 st.pos=[x,y];st.placed=true;kPaint()}
function kChain(i){const k=App.cur.k;kMig(k);const G=kGrid(k),{W:KW,H:KH}=G;const st=k.steps[i];kFixWt(st);
 if(st.op==='wt'){st.pos=kSP(G,st,KW*KH-1);st.placed=true}else if(st.op==='label'){st.pos=[KW-1,KH-1];st.placed=true;st.tw=st.tn||0}else if(st.op==='apply'){st.pos=[KW-1,KH-1];st.placed=true}else st.done=Array(KW*KH).fill(1);
 k.steps.length=i+1;k.steps.push({op:'erode',conn:8,K:KP[1][1].map(r=>r.slice()),pos:[0,0],placed:false,done:[],sig:''});kui.act=k.steps.length-1;renderKern();kPaint();
 kE.steps[kui.act].main.scrollIntoView({block:'nearest',behavior:'smooth'})}
function kInf(el){const p=el.selectionStart,a=el.value.slice(0,p).replace(/inf/ig,'∞').length;el.value=el.value.replace(/inf/ig,'∞');try{el.setSelectionRange(a,a)}catch(e){}}
function kSeg(sel,labels){const g=mk('div','seg');
 const btns=[...sel.options].map((o,n)=>{const b=mk('button','',labels?labels[n]:o.text);b.onclick=()=>{sel.value=o.value;sel.dispatchEvent(new Event('change'));upd()};g.append(b);return b}),
  upd=()=>btns.forEach((b,n)=>b.setAttribute('aria-pressed',sel.options[n].value===sel.value));
 upd();sel.hidden=true;return{el:g,upd}}
function kAlgNorm(el){const f=s=>s.replace(/\(-\)/g,'\u2296').replace(/\(\+\)/g,'\u2295').replace(/\(o\)/gi,'\u2218').replace(/\(\.\)/g,'\u2022').replace(/&/g,'\u2229').replace(/\|/g,'\u222a').replace(/-/g,'\u2212').replace(/['~]/g,'\u1d9c');
 const p=el.selectionStart,a=f(el.value.slice(0,p)).length;el.value=f(el.value);try{el.setSelectionRange(a,a)}catch(e){}}
function kDrawLab(G,x,vals,mut,inp){for(let j=0;j<vals.length;j++){const v=vals[j];
  if(mut&&mut(j)){x.globalAlpha=.4;const iv=inp[j];kCell(G,x,j,iv===0?'#fff':'#cfd8e3',iv===0?'0':kFmt(iv),'#123');x.globalAlpha=1;continue}
  kCell(G,x,j,v?`hsl(${(v*67)%360},65%,76%)`:'#fff',v?kFmt(v):'0',v?'#222':'#999')}}
function kTable(Es,st,T,prevT,win){Es.tcells.innerHTML='';
 for(let l=1;l<T.length;l++){const d=mk('div','tc'+(prevT&&prevT[l]!==T[l]?' chg':'')+(l===win?' win':'')+(st.Tedit&&st.Tedit[l]!=null?' ed':''));d.append(mk('span','cap',l));
  const e=document.createElement('input');e.type='text';e.value=T[l];e.onchange=()=>{const v=parseInt(e.value);if(isNaN(v)||v<1)delete st.Tedit[l];else st.Tedit[l]=v;kPaint()};d.append(e);Es.tcells.append(d)}
 if(T.length<2)Es.tcells.textContent='(no labels yet)'}
const KOP_LABELS=['Erosion','Dilation','Hit-or-miss','Algebra','Weighted min/max-plus','Sequential labeling','Relabel through table'];
const KALG_SYMS=[['A','A (the input image)'],['B','B (the structuring element)'],['⊖','erosion'],['⊕','dilation'],['∘','opening'],['•','closing'],['∩','intersection (and)'],['∪','union (or)'],['−','difference'],['ᶜ','complement'],['(','('],[')',')']];
const KALG_EXAMPLES=[['Boundary','A − (A ⊖ B)'],['Outer boundary','(A ⊕ B) − A'],['Gradient','(A ⊕ B) − (A ⊖ B)'],['Opening','(A ⊖ B) ⊕ B'],['Closing','(A ⊕ B) ⊖ B'],['Top-hat','A − ((A ⊖ B) ⊕ B)']];
const KARROWS={l:['Left','M19 12H5M11 6l-6 6 6 6'],u:['Up','M12 19V5M6 11l6-6 6 6'],d:['Down','M12 5v14M6 13l6 6 6-6'],r:['Right','M5 12h14M13 6l6 6-6 6']};
// Small DOM helpers for step cards. seg() also registers the control's refresh function in Es.segs.
function kHelpers(Es){
  const row=css=>{const r=mk('div','row');if(css)r.style.cssText=css;return r};
 const btn=(l,f,cls)=>{const b=mk('button',cls||'',l);b.onclick=f;return b};
 const sel=(opts)=>{const s=mk('select');s.innerHTML=opts.map(([v,l])=>`<option value='${v}'>${l}</option>`).join('');return s};
 const seg=(s,labels)=>{const g=kSeg(s,labels);Es.segs.push(g.upd);return g};
 const grp=(lab,el)=>{const g=mk('div','kg');g.append(mk('div','kgl',lab),el);return g};
 const dragSrc=(el,key)=>{el.draggable=true;el.ondragstart=ev=>ev.dataTransfer.setData('text/plain','kern:'+key)};
 return{row,btn,sel,seg,grp,dragSrc}}
// The operation picker (Es.op, Es.opSeg) and the four parameter panels: algebra (Es.alg), labeling (Es.lab),
// structuring element (Es.r2) and weighted kernel (Es.wt). Shared by the grid and the image step cards.
// go() marks this step active and repaints.
function kPanels(Es,st,i,go){
 const{row,btn,sel,seg,grp,dragSrc}=kHelpers(Es);
 Es.op=sel(KOPS);Es.op.onchange=()=>{st.op=Es.op.value;go()};
 Es.conn=sel([[4,'V4 connectivity'],[8,'V8 connectivity']]);Es.conn.onchange=()=>{st.conn=+Es.conn.value;go()};// lives in the labeling panel as a segmented control
 Es.opSeg=seg(Es.op,KOP_LABELS).el;

 // panel: algebra expression
 Es.alg=mk('div','kpanel');
 const inp=document.createElement('input');inp.type='text';inp.spellcheck=false;inp.value=st.expr;
 inp.style.cssText='width:100%;box-sizing:border-box;font:600 16px monospace;padding:8px 10px;border:1.5px solid var(--mut);border-radius:6px;background:var(--card);color:var(--ink)';
 const setExpr=()=>{st.expr=inp.value;go()};inp.oninput=()=>{kAlgNorm(inp);setExpr()};
 const ins=mk('div','chips');ins.style.margin='8px 0';
 KALG_SYMS.forEach(([s,t])=>{const b=btn(s,()=>{const a=inp.selectionStart??inp.value.length,e=inp.selectionEnd??a;inp.value=inp.value.slice(0,a)+s+inp.value.slice(e);inp.focus();inp.setSelectionRange(a+s.length,a+s.length);setExpr()},'chip');b.title=t;ins.append(b)});
 const ex=mk('div','chips');KALG_EXAMPLES.forEach(([l,x])=>{const b=btn(l,()=>{inp.value=x;setExpr()});b.title=x;ex.append(b)});
 Es.err=mk('div','cap');Es.err.style.color='var(--curve)';
 Es.alg.append(mk('div','kph','Expression'),inp,ins,mk('div','kgl','Examples'),ex,Es.err,mk('div','cap',"A = this step's input image, B = the structuring element below. You can also type (-) (+) (o) (.) for the morphology symbols, & | - for and, or, minus, and ' for complement."));

 // panel: labeling
 Es.lab=mk('div','kpanel');Es.lh=mk('div','kph','');Es.sc=seg(Es.conn,['V4: left, up','V8: left, up, up-left, up-right']);
 Es.lmsg=mk('div','cap');Es.lmsg.style.color='var(--curve)';Es.lab.append(Es.lh,Es.sc.el,Es.lmsg);

 // panel: binary structuring element
 Es.r2=row('margin-top: 10px;');Es.r2.classList.add('kpanel');
 Es.kh1=mk('div','kph','');Es.act1=mk('div','kact');
 const pr=mk('div','chips');
 Es.kpb=KP.map(([l,M],pi)=>{const b=btn(kSvg(M,16,false)+`<span class='cap'>${l}</span>`,()=>{st.K=M.map(r=>r.slice());Es.ksz.value=3;kEd(Es,st);st.placed=true;go()},'km');b.title=l;dragSrc(b,'p'+pi);pr.append(b);return b});
 Es.ksz=sel([3,5,7].map(n=>[n,`${n} x ${n}`]));Es.ksz.value=st.K.length;
 Es.ksz.onchange=()=>{const n=+Es.ksz.value;st.K=Array.from({length:n},()=>Array(n).fill(1));kEd(Es,st);kPaint()};
 Es.ked=mk('div','ked');kEd(Es,st);dragSrc(Es.ked,'s'+i);Es.ked.title='Drag this kernel onto the image';
 Es.kedHelp=mk('div','cap');
 const ke=mk('div','col');ke.append(Es.kedHelp,Es.ksz,mk('div','kgl','Size'),seg(Es.ksz,['3 x 3','5 x 5','7 x 7']).el,Es.ked);
 Es.r2.append(Es.kh1,Es.act1,pr,ke);

 // panel: weighted (min/max-plus) kernel
 Es.wt=row('margin-top: 10px;');Es.wt.classList.add('kpanel');Es.act2=mk('div','kact');
 const pw=mk('div','chips');
 KPW.forEach(([l,Wt],pi)=>{const b=btn(kSvgW(Wt,18)+`<span class='cap'>${l}</span>`,()=>{kApplyW(st,pi);kWSync(Es,st);go()},'km');b.title=l+' (also sets the scan direction)';dragSrc(b,'w'+pi);pw.append(b)});
 Es.red=sel([['min','Reduce: minimum'],['max','Reduce: maximum']]);Es.red.onchange=()=>{st.red=Es.red.value;kWed(Es,st);kPaint()};
 Es.dx=sel([['lr','Columns: left to right'],['rl','Columns: right to left']]);Es.dx.onchange=()=>{st.dx=Es.dx.value;kPaint()};
 Es.dy=sel([['tb','Rows: top to bottom'],['bt','Rows: bottom to top']]);Es.dy.onchange=()=>{st.dy=Es.dy.value;kPaint()};
 Es.wsz=sel([3,5].map(n=>[n,`${n} x ${n}`]));
 Es.wsz.onchange=()=>{const n=+Es.wsz.value;st.Wt=Array.from({length:n},(_,j)=>Array.from({length:n},(_,q)=>j===n>>1&&q===n>>1?0:null));kWed(Es,st);kPaint()};
 const sq=mk('div','seg');[['Sequential',true],['From input',false]].forEach(([l,v])=>sq.append(btn(l,()=>{st.seq=v;kPaint()})));
 Es.wed=mk('div','ked');
 const g1=seg(Es.red,['Minimum','Maximum']),g2=seg(Es.dx,['Left to right','Right to left']),g3=seg(Es.dy,['Top to bottom','Bottom to top']),g4=seg(Es.wsz,['3 x 3','5 x 5']);
 Es.segs.push(()=>[...sq.children].forEach((b,n)=>b.setAttribute('aria-pressed',(n===0)===!!st.seq)));
 const dg=Es.wtDrag=mk('div','cap','Drag this kernel onto the image');dragSrc(dg,'s'+i);dg.style.cssText='cursor:grab;border:1px dashed var(--line);border-radius:6px;padding:4px 8px;width:max-content';
 const ctl=mk('div','col');
 ctl.append(mk('div','cap','Each cell is a weight added to the pixel under it. ∞ = unused cell (type inf or ∞).'),grp('Combine neighbors by',g1.el),grp('Scan columns',g2.el),grp('Scan rows',g3.el),grp('Each cell reads',sq),grp('Size',g4.el),dg,Es.wed,Es.red,Es.dx,Es.dy,Es.wsz);
 Es.wt.append(mk('div','kph','Kernel programming'),Es.act2,pw,ctl);kWSync(Es,st);
}
function kStepCard(E,k,st,i){
 kFixWt(st);if(st.expr==null)st.expr='A − (A ⊖ B)';if(!st.Tedit)st.Tedit={};
 const Es={segs:[]};E.steps[i]=Es;let G=kGrid(k);// refreshed in cell() and setPos(): the grid can be resized while this card is on screen
 const c=mk('section','card'),go=()=>{kui.act=i;kPaint()},{row,btn}=kHelpers(Es);
 const cell=e=>{kMig(k);G=kGrid(k);const{W:KW,H:KH}=G,r=Es.main.getBoundingClientRect(),m=Es.m||0;return[kCl(Math.floor((e.clientX-r.left)/r.width*(KW+2*m))-m,0,KW-1),kCl(Math.floor((e.clientY-r.top)/r.height*(KH+2*m))-m,0,KH-1)]};

 // header
 const h=mk('h2','',`Step ${i+1}${i?' (input = result of step '+i+')':''}`);
 if(i>0)h.append(mk('span','sp'),btn('Remove this step',()=>{k.steps.length=i;kui.act=Math.min(kui.act,i-1);renderKern();kPaint()}));

 // operation picker and scan controls
 kPanels(Es,st,i,go);
 const ar=mk('div','chips');
 Object.entries(KARROWS).forEach(([d,[name,path]])=>{const b=btn(IC(`<path d='${path}'/>`),()=>kMove(d,i),'ibtn');b.title=name+' (arrow key)';b.setAttribute('aria-label',name);ar.append(b)});
 const setPos=f=>()=>{kFixWt(st);G=kGrid(k);st.pos=f();st.placed=true;kui.act=i;if(st.op==='label')st.tw=st.pos[1]*G.W+st.pos[0]===G.W*G.H-1?(st.tn||0):0;kPaint()};
 ar.append(btn('Start',setPos(()=>st.op==='wt'?kSP(G,st,0):[0,0])),btn('End',setPos(()=>st.op==='wt'?kSP(G,st,G.W*G.H-1):[G.W-1,G.H-1])),btn('Remove kernel',()=>{st.placed=false;go()}));
 Es.pos=mk('span','cap');
 const rOp=row();rOp.append(Es.op,Es.opSeg,ar,Es.pos);

 // input grid (left) and result grid (right)
 const rIo=row('margin-top: 10px; align-items: flex-end;'),a=mk('div','kcol'),b=mk('div','kcol');
 if(i===0){const vr=mk('div','chips');E.views={};
  [['drawing','Drawing'],['thresh','Thresholded'],['numbers','Binary numbers']].forEach(([v,l])=>{const x=btn(l,()=>{k.view=v;kPaint()},'chip');E.views[v]=x;vr.append(x)});
  a.append(vr,kInputValues(E,k))}
 else a.append(mk('div','cap',`Input: result of step ${i}`));
 Es.main=mk('canvas','v kcv');Es.out=mk('canvas','v kcv');Es.out.style.cursor='default';
 Es.ghost=mk('canvas','kghost');Es.pulse=mk('div','kpulse');Es.pulse.hidden=true;
 const wrap=mk('div','kwrap');wrap.append(Es.main,Es.ghost,Es.pulse);a.append(wrap);
 const mh=mk('div','mh'),mb=mk('button','ibtn',IC(`<circle cx='5' cy='12' r='1.5'/><circle cx='12' cy='12' r='1.5'/><circle cx='19' cy='12' r='1.5'/>`)),mn=mk('div','menu');
 mb.title='Result options';mb.setAttribute('aria-label','Result options');mn.hidden=true;
 mb.onclick=ev=>{ev.stopPropagation();const o=mn.hidden;document.querySelectorAll('.menu').forEach(z=>z.hidden=true);mn.hidden=!o};
 Es.chain=btn('Use as input for new operation',()=>{mn.hidden=true;kChain(i)});Es.chain.title='Finishes this step\'s scan, then starts a new operation below';
 const rr=btn('Reset result',()=>{mn.hidden=true;st.done=[];st.placed=false;st.pos=[0,0];st.Tedit={};st.tw=0;st.moved=false;go()});rr.title='Start this step again: clears the scan progress and table edits';
 mn.append(Es.chain,rr);mh.append(mk('span','cap','Result'),mb,mn);b.append(mh,Es.out);rIo.append(a,b);

 // correspondence table
 Es.tbx=mk('div','kpanel');const th=mk('div','mh');
 Es.tbxCap=mk('span','cap','Correspondence table T (editable; teal ring = changed, dark outline = entry being upgraded, red = edited by you)');
 Es.tbxReset=btn('Reset edits',()=>{st.Tedit={};kPaint()});th.append(Es.tbxCap,Es.tbxReset);
 Es.tcells=mk('div','tcells');Es.tbx.append(th,Es.tcells);

 c.append(h,rOp,Es.alg,Es.lab,Es.r2,Es.wt,rIo,Es.tbx);

 // pointer interaction on the input grid: drawing (step 1) or placing the kernel
 let drag=null;
 Es.main.oncontextmenu=e=>e.preventDefault();
 Es.main.onpointerdown=e=>{Es.main.setPointerCapture(e.pointerId);kui.act=i;const p=cell(e);
  if(i===0&&k.tool==='paint'){const er=e.button===2||e.shiftKey;kPx(G,k,p,er);drag={t:'paint',er};kPaint();return}
  if(i>0||k.view!=='drawing'){st.pos=p;st.placed=true;kui.dragging=true;drag={t:'kern'};kPaint();return}
  if(k.tool==='select'){const hit=[...k.shapes].reverse().find(q=>kcells(G,q)[p[1]*G.W+p[0]]);
   if(!hit){if(!e.shiftKey)kui.sel.clear();drag=null;kPaint();return}
   const ids=hit.g?k.shapes.filter(q=>q.g===hit.g).map(q=>q.id):[hit.id];
   if(e.shiftKey){ids.every(z=>kui.sel.has(z))?ids.forEach(z=>kui.sel.delete(z)):ids.forEach(z=>kui.sel.add(z))}else if(!kui.sel.has(hit.id)){kui.sel.clear();ids.forEach(z=>kui.sel.add(z))}
   drag={t:'move',last:p};kui.dragging=true;kPaint();return}
  kui.draft=k.tool==='free'?{id:k.nx,t:'free',pts:[p],fill:false,g:0}:{id:k.nx,t:k.tool,a:p,b:p,fill:k.fill,g:0};drag={t:'draw'};kPaint()};
 Es.main.onpointermove=e=>{if(!drag)return;const p=cell(e);
  if(drag.t==='paint')kPx(G,k,p,drag.er);
  else if(drag.t==='kern')st.pos=p;
  else if(drag.t==='move'){const dx=p[0]-drag.last[0],dy=p[1]-drag.last[1];if(!dx&&!dy)return;drag.last=p;
   k.shapes.forEach(q=>{if(!kui.sel.has(q.id))return;if(q.t==='free')q.pts=q.pts.map(z=>[z[0]+dx,z[1]+dy]);else{q.a=[q.a[0]+dx,q.a[1]+dy];q.b=[q.b[0]+dx,q.b[1]+dy]}})}
  else if(kui.draft){if(kui.draft.t==='free'){const l=kui.draft.pts[kui.draft.pts.length-1];if(l[0]!==p[0]||l[1]!==p[1])kui.draft.pts.push(p)}else kui.draft.b=p}
  kPaint()};
 Es.main.onpointerup=Es.main.onpointercancel=()=>{if(drag&&drag.t==='draw'&&kui.draft){kui.draft.id=k.nx++;k.shapes.push(kui.draft);kui.sel.clear();kui.sel.add(kui.draft.id)}kui.draft=null;drag=null;kui.dragging=false;kPaint()};
 Es.main.ondragover=e=>e.preventDefault();
 Es.main.ondrop=e=>{e.preventDefault();const t=e.dataTransfer.getData('text/plain');if(t.indexOf('kern:')!==0)return;const q=t.slice(5),n=+q.slice(1);
  const takeK=K=>{st.K=K.map(r=>r.slice());if(st.op==='wt')st.op='erode';Es.ksz.value=st.K.length;kEd(Es,st)};
  if(q[0]==='p'&&KP[n])takeK(KP[n][1]);
  else if(q[0]==='w'&&KPW[n])kApplyW(st,n);
  else if(q[0]==='s'&&k.steps[n]){const o=k.steps[n];kFixWt(o);if(o.op==='wt'){st.Wt=o.Wt.map(r=>r.slice());st.red=o.red;st.seq=o.seq;st.dx=o.dx;st.dy=o.dy;st.op='wt'}else takeK(o.K)}
  kWSync(Es,st);st.pos=cell(e);st.placed=true;go()};
 return c}
// "1s read as / 0s read as" fields and the numeric grid paste box (step 1 only)
function kInputValues(E,k){
 const inr=mk('div','row');inr.style.cssText='gap:10px;margin:6px 0;align-items:center';
 const fld=(lab,key,ref)=>{const l=mk('label','sw',`${lab} <input type='text' class='sq'>`),inp=l.querySelector('input'),b=mk('button','','∞');b.title='Use ∞';
  inp.oninput=()=>kInf(inp);inp.onchange=()=>{k[key]=inp.value.trim()||(key==='in1s'?'1':'0');kPaint()};b.onclick=()=>{k[key]='∞';kPaint()};E[ref]=inp;inr.append(l,b)};
 fld('1s read as','in1s','in1');fld('0s read as','in0s','in0');
 const det=mk('details','',`<summary class='cap'>Paste a grid of numbers (use ∞ for infinity)</summary>`),ta=mk('textarea');ta.rows=6;ta.cols=30;ta.placeholder='0 0 0 0\n0 ∞ ∞ 0\n0 ∞ ∞ 0';ta.oninput=()=>kInf(ta);ta.style.cssText='font:13px monospace;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:6px';
 const ld=mk('button','','Load grid');ld.onclick=()=>{const rows=ta.value.trim().split(/\n+/).map(l=>l.trim().split(/[\s,;]+/)).filter(r=>r[0]!=='');if(!rows.length)return;
  const W=kCl(Math.max(...rows.map(r=>r.length)),4,32),H=kCl(rows.length,4,32);k.W=W;k.H=H;k.num=Array.from({length:W*H},(_,j)=>{const r=rows[(j/W)|0];return r&&r[j%W]!=null?r[j%W]:'0'});kPaint()};
 E.clr=mk('button','','Clear pasted grid');E.clr.hidden=true;E.clr.onclick=()=>{delete k.num;kPaint()};
 const bt=mk('div','chips');bt.append(ld,E.clr);det.append(ta,bt);inr.append(det);return inr}
function kRunMorph(G,st,Es,E,input){return{full:Float64Array.from(kout(G,st,kBin(input)).v),lim:-1}}
const KRUN={
 erode:kRunMorph,dilate:kRunMorph,hm:kRunMorph,
 alg(G,st,Es,E,input){const r=kalg(G,st.expr||'A',kBin(input),st.K);Es.err.textContent=r.err||'';return{full:Float64Array.from(r.err?new Uint8Array(input.length):r.v),lim:-1}},
 wt(G,st,Es,E,input){const lim=st.placed?kSI(G,st,st.pos[0],st.pos[1]):-1;return{full:kwt(G,input,st),part:kwt(G,input,st,lim),lim}},
 label(G,st,Es,E,input,idx){
  const lim=st.placed?idx:-1,F=klab(G,input,st),P=klab(G,input,st,lim),n=F.T.length-1,done=lim===G.W*G.H-1,tw=done?kCl(st.tw||0,0,n):0;
  let msg='',tblPart;st.tw=tw;st.tn=n;Es.tdone=done;Es.twl=done?tw:0;
  if(done){Es.told=F.T;tblPart=kWithEdits(st,kFlat(F.T,tw));Es.tprev=kWithEdits(st,kFlat(F.T,Math.max(0,tw-1)));
   if(tw>0){const T0=kFlat(F.T,tw-1);let m=tw,path=[tw],g=0;while(T0[m]!==m&&g++<999){m=T0[m];path.push(m)}msg=`Upgrading the table: l = ${tw}: ${path.join(' → ')}, so T[${tw}] = ${m}.`}
   else if(n)msg='Image scan complete. Keep pressing the right arrow to upgrade the table one entry at a time.'}
  else{Es.told=null;tblPart=kWithEdits(st,P.T);Es.tprev=lim>0?kWithEdits(st,klab(G,input,st,lim-1).T):null}
  kLabMsg(Es,msg,true);
  return{full:F.E,part:P.E,lim,tblOut:kWithEdits(st,kFlat(F.T,n)),tblPart}},
 apply(G,st,Es,E,input,idx){
  if(!E.tbl){kLabMsg(Es,'This step needs a correspondence table: put a Sequential labeling step before it.',false);return{full:input,part:input,lim:-1}}
  const T=E.tbl,full=input.map(v=>v?(T[v]!=null?T[v]:v):0);kLabMsg(Es,'',true);
  return{full,part:full,lim:st.placed?idx:-1}}};
function kLabMsg(Es,msg,ok){Es.lmsg.textContent=msg;Es.lmsg.style.color=ok?'var(--mut)':'var(--curve)'}
function kPaint(){
 if(isImg(App.cur)){if(App.tab==='kern')imageMode.paint();return}
 const s=App.cur,E=kE;if(!s||!s.k||!E||App.tab!=='kern')return;save();
 const k=s.k;kMig(k);const G=kGrid(k),{W:KW,H:KH}=G;const css=getComputedStyle(document.documentElement),col={acc:css.getPropertyValue('--acc').trim(),crv:css.getPropertyValue('--curve').trim()};
 E.fill.checked=k.fill;E.gw.value=k.W;E.gh.value=k.H;E.in1.value=k.in1s||'1';E.in0.value=k.in0s||'0';E.clr.hidden=!k.num;E.tbl=null;
 Object.entries(E.tools).forEach(([t,b])=>b.setAttribute('aria-pressed',k.tool===t));
 Object.entries(E.views).forEach(([t,b])=>b.setAttribute('aria-pressed',k.view===t));
 const v1=kNum(k.in1s||'1'),v0=kNum(k.in0s||'0');
 let input=k.num?Float64Array.from({length:KW*KH},(_,j)=>kNum(k.num[j]==null?'0':k.num[j])):Float64Array.from(kimg(G,k),v=>v?v1:v0),prev=JSON.stringify([k.shapes,k.px,k.W,k.H,k.in1s,k.in0s,k.num]);
 k.steps.forEach((st,i)=>{
  const Es=E.steps[i];if(!Es)return;
  if(!KOPS.some(o=>o[0]===st.op))st.op='erode';kFixWt(st);
  st.pos=[kCl(st.pos[0]|0,0,KW-1),kCl(st.pos[1]|0,0,KH-1)];
  const sig=prev+JSON.stringify([st.op,st.K,st.Wt,st.red,st.seq,st.dx,st.dy,st.expr,st.conn,st.Tedit]);if(st.sig!==sig||!st.done){st.sig=sig;st.done=[]}
  const idx=st.pos[1]*KW+st.pos[0];if(st.placed&&st.op!=='wt')st.done[idx]=1;
  const r=KRUN[st.op](G,st,Es,E,input,idx);
  kDrawInput(G,Es,k,st,i,input,v1!==1||v0!==0,col);
  kDrawResult(G,Es,st,r,input,col);
  kSyncStep(G,Es,E,k,st,i,r,input,idx,col);
  E.tbl=r.tblOut||null;prev=sig;input=r.full});
 drawSide()}
function kDrawInput(G,Es,k,st,i,input,remapped,{acc,crv}){const{C:KC,H:KH,W:KW}=G;
 Es.m=kM(st);Es.R=Es.m;const x=prepM(G,Es.main,Es.m),W=KW*KC,H=KH*KC;
 if(i===0&&k.view==='drawing'&&!k.num){
  x.strokeStyle='#e6e6e6';x.lineWidth=1;x.beginPath();for(let a=0;a<=KW;a++){x.moveTo(a*KC+.5,0);x.lineTo(a*KC+.5,H)}for(let b=0;b<=KH;b++){x.moveTo(0,b*KC+.5);x.lineTo(W,b*KC+.5)}x.stroke();
  (kui.draft?[...k.shapes,kui.draft]:k.shapes).forEach(sh=>kDraw(G,x,sh));
  for(const key in k.px){if(k.px[key]!==1)continue;const[a,b]=key.split(',').map(Number);if(kIn(G,a,b)){x.fillStyle='#333';x.fillRect(a*KC,b*KC,KC,KC)}}
  if(kui.sel.size)kSelBox(G,x,k,acc);
 }else if(i>0&&k.steps[i-1].op==='label')kDrawLab(G,x,input,null,input);
 else kDrawVals(G,x,input,null,i>0||k.view==='numbers'||!!k.num||remapped);
 if(!st.placed)return;
 x.save();x.beginPath();x.rect(0,0,W,H);x.clip();
 if(st.op==='wt')kKernelW(G,x,st,acc);
 else if(st.op==='apply'){x.strokeStyle=acc;x.lineWidth=4;x.strokeRect(st.pos[0]*KC+2,st.pos[1]*KC+2,KC-4,KC-4)}
 else kKernel(G,x,{K:kEff(st),pos:st.pos},acc,crv);
 x.restore()}
function kDrawResult(G,Es,st,r,input,{acc}){const{C:KC,W:KW}=G;
 const x=prepM(G,Es.out,Es.m),lim=r.lim;
 if(st.op==='label'||st.op==='apply')kDrawLab(G,x,r.part,j=>j>lim,input);
 else if(st.op==='wt')kDrawVals(G,x,r.part,j=>kSI(G,st,j%KW,(j/KW)|0)>lim,true);
 else r.full.forEach((v,j)=>{if(!st.done[j])kCell(G,x,j,'#ececec','','');else kCell(G,x,j,v?'#222':'#fff',v,v?'#fff':'#999')});
 if(st.op==='label'&&Es.twl){x.save();x.strokeStyle='#000';x.lineWidth=3;r.part.forEach((v,j)=>{if(v===Es.twl)x.strokeRect((j%KW)*KC+2,((j/KW)|0)*KC+2,KC-4,KC-4)});x.restore()}
 if(st.placed){x.strokeStyle=acc;x.lineWidth=3;x.strokeRect(st.pos[0]*KC+1.5,st.pos[1]*KC+1.5,KC-3,KC-3)}}
// Panel visibility, help texts, segmented controls and preset highlighting. image = whole-image mode texts.
const KLAB_IMG={label:'Sequential labeling: one raster pass gives provisional labels and the correspondence table T; add a "Relabel through table" step to resolve them',
 apply:'Relabel through the table: every pixel takes its final label from the table built by the labeling step above'};
function kSyncPanels(Es,st,image){const op=st.op,wt=op==='wt',isLab=op==='label'||op==='apply';
 Es.op.value=op;Es.r2.hidden=wt||isLab;Es.wt.hidden=!wt;Es.alg.hidden=op!=='alg';Es.lab.hidden=!isLab;Es.sc.el.hidden=op!=='label';Es.conn.value=st.conn;
 Es.lh.textContent=image?(KLAB_IMG[op]||''):({label:'Labeling pass, then table upgrade: scan the image with the arrows; once it is complete, keep stepping right to upgrade the table entry by entry',apply:'Relabel through the table: move the box over the pixels; each pixel takes its value from the upgraded table'}[op]||'');
 if(Es.lastOp!==op){Es.lastOp=op;kEd(Es,st);
  Es.kh1.textContent=image?({erode:'Structuring element: erosion takes the minimum of the pixels under the teal cells',dilate:'Structuring element: dilation takes the maximum of the pixels under the reflected element',hm:'Hit-or-miss pattern',alg:'B = structuring element'}[op]||''):{erode:'Structuring element - erosion keeps a pixel only if every teal cell lies on foreground',dilate:'Structuring element - dilation sets a pixel if any teal cell touches foreground',hm:'Hit-or-miss pattern',alg:'B = structuring element'}[op]||'';
  Es.kedHelp.textContent=(image?'':'Drag the kernel onto the image. ')+(op==='hm'?'Click a cell to cycle teal 1 (foreground), red 0 (background), dashed (ignored).':'Click a cell to switch it on (teal) or off (dashed).')}
 Es.segs.forEach(f=>f());
 // highlight the preset that matches the current kernel
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),bi=KP.findIndex(([,M])=>same(M,st.K)),wi=KPW.findIndex(([,Wt,dx,dy])=>same(Wt,st.Wt)&&dx===st.dx&&dy===st.dy&&st.red==='min');
 Es.kpb.forEach((b,pi)=>{b.hidden=op!=='hm'&&pi>3;b.setAttribute('aria-pressed',pi===bi)});
 [...Es.wt.querySelectorAll('button.km')].forEach((b,pi)=>b.setAttribute('aria-pressed',pi===wi));
 Es.act1.innerHTML=`Active: <b>${bi>=0?KP[bi][0]:'Custom'}</b> (${st.K.length} x ${st.K.length})`;
 Es.act2.innerHTML=`Active: <b>${wi>=0?KPW[wi][0]:'Custom'}</b> (${st.Wt.length} x ${st.Wt.length})`;
}
function kSyncStep(G,Es,E,k,st,i,r,input,idx,{acc,crv}){const{H:KH,W:KW}=G;
 const op=st.op,wt=op==='wt';
 // correspondence table panel
 if(op==='label'){if(Es.wasDone!==undefined&&Es.tdone&&!Es.wasDone){Es.tbx.classList.remove('pulse');void Es.tbx.offsetWidth;Es.tbx.classList.add('pulse')}Es.wasDone=!!Es.tdone}
 if(op==='apply'&&E.tbl){Es.tbx.hidden=false;Es.tbxCap.textContent='Upgraded table T (read-only reference): the outlined entry is the one the box is using';Es.tbxReset.hidden=true;kTableRO(Es,E.tbl,st.placed?input[idx]:0)}
 else if(op==='label'){Es.tbxCap.textContent='Correspondence table T (editable; teal ring = changed, dark outline = entry being upgraded, red = edited by you)';Es.tbxReset.hidden=false;Es.tcells.style.opacity='';Es.tbx.hidden=false;kTable2(Es,st,r.tblPart||[0],Es.tprev,Es.twl,Es.told)}
 else Es.tbx.hidden=true;
 kSyncPanels(Es,st,false);
 // status line
 Es.pos.textContent=
  op==='apply'?(st.placed?`Box at (${st.pos[0]}, ${st.pos[1]}), pixel ${idx+1} of ${KW*KH}. Each pixel takes its value from the table.`:'Click a pixel in the input grid to place the box, then step with the arrows. The image is relabeled as the box moves.')
  :op==='label'&&Es.tdone&&Es.tn?`Image scan complete. Table upgrade: ${st.tw||0} of ${Es.tn} entries (right arrow continues, left arrow goes back).`
  :!st.placed?'Drag a kernel onto the image, then step with the arrows. The result fills in as the kernel moves.'
  :wt?`Scan position ${r.lim+1} of ${KW*KH}, cell (${st.pos[0]}, ${st.pos[1]}). Cells before it are updated; the rest still hold their input values.`
  :`Kernel anchor (${st.pos[0]}, ${st.pos[1]}) · step ${idx+1} of ${KW*KH}`;
 // kernel ghost outside the grid border, and the "drag me" pulse
 const n=wt?st.Wt.length:op==='label'?3:op==='apply'?1:st.K.length,rr=n>>1,m=Es.m||0,TW=KW+2*m,TH=KH+2*m;
 kGhost(G,Es,st,wt,acc,crv);Es.pulse.hidden=!(st.placed&&!st.moved);
 Es.pulse.style.cssText=`left:${(st.pos[0]-rr+m)/TW*100}%;top:${(st.pos[1]-rr+m)/TH*100}%;width:${n/TW*100}%;height:${n/TH*100}%`;
 Es.chain.disabled=i!==k.steps.length-1;
 Es.main.style.cursor=i===0&&k.tool==='paint'?'cell':(i>0||k.view!=='drawing')?(kui.dragging?'grabbing':'grab'):k.tool==='select'?(kui.dragging?'grabbing':'default'):kCur(k.tool)}
function kTable2(Es,st,T,prevT,win,old){const el=Es.tcells;
 if(!old){kTable(Es,st,T,prevT,win);return}
 el.innerHTML='';const lead=mk('div','tc');lead.append(mk('span','cap','label'),mk('span','cap tlab','old'),mk('span','cap tlab','new'));el.append(lead);
 for(let l=1;l<T.length;l++){const ed=st.Tedit&&st.Tedit[l]!=null,proc=l<=win||ed,chg=l<=win&&T[l]!==old[l];
  const d=mk('div','tc'+(l===win?' win':'')+(chg?' chg':'')+(ed?' ed':''));d.append(mk('span','cap',l),mk('div','tco',old[l]));
  const e=document.createElement('input');e.type='text';e.value=proc?T[l]:'';e.placeholder='\u00b7';
  e.onchange=()=>{const v=parseInt(e.value);if(isNaN(v)||v<1)delete st.Tedit[l];else st.Tedit[l]=v;kPaint()};d.append(e);el.append(d)}}
function kTableRO(Es,T,hl){const el=Es.tcells;el.innerHTML='';el.style.opacity='.75';
 for(let l=1;l<T.length;l++){const d=mk('div','tc'+(l===hl?' win':''));d.append(mk('span','cap',l),mk('div','tco',T[l]));el.append(d)}}
function kGhost(G,Es,st,wt,acc,crv){const{C:KC,H:KH,W:KW}=G;const R=Es.R||0,g=Es.ghost;if(!g)return;
 const K=wt?st.Wt:st.op==='label'?kEff(st):st.op==='apply'?null:st.K;
 if(!K||!st.placed||!R){g.classList.remove('on');return}
 const n=K.length,r=n>>1,[px,py]=st.pos,kc=new Map(),cols=new Set(),rows=new Set();
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const xx=px+i-r,yy=py+j-r;kc.set(xx+','+yy,K[j][i]);if(xx<0||xx>=KW)cols.add(xx);if(yy<0||yy>=KH)rows.add(yy)}
 if(!cols.size&&!rows.size){g.classList.remove('on');return}
 const W=KW*KC,H=KH*KC;g.width=W+2*R*KC;g.height=H+2*R*KC;g.style.left='0';g.style.top='0';g.style.width='100%';g.style.height='100%';
 const x=g.getContext('2d');x.font=KC*.4+'px monospace';x.textAlign='center';x.textBaseline='middle';x.translate(R*KC,R*KC);
 const cells=new Set();
 cols.forEach(a=>{for(let b=0;b<KH;b++)cells.add(a+','+b)});rows.forEach(b=>{for(let a=0;a<KW;a++)cells.add(a+','+b)});
 kc.forEach((v,key)=>{const[a,b]=key.split(',').map(Number);if(!kIn(G,a,b))cells.add(key)});
 cells.forEach(key=>{const[a,b]=key.split(',').map(Number);x.fillStyle='rgba(140,140,140,.35)';x.fillRect(a*KC,b*KC,KC,KC);x.strokeStyle='rgba(140,140,140,.55)';x.lineWidth=1;x.strokeRect(a*KC+.5,b*KC+.5,KC-1,KC-1);
  if(!wt&&!kc.has(key)){x.fillStyle='rgba(120,120,120,.9)';x.fillText('0',a*KC+KC/2,b*KC+KC/2+1)}});
 x.save();x.beginPath();x.rect(-R*KC,-R*KC,W+2*R*KC,H+2*R*KC);x.rect(0,0,W,H);x.clip('evenodd');
 if(wt)kKernelW(G,x,st,acc);else kKernel(G,x,{K,pos:st.pos},acc,crv);x.restore();
 g.classList.add('on')}
function kM(st){return st.op==='wt'?(st.Wt||[[0]]).length>>1:st.op==='label'?1:st.op==='apply'?0:((st.K||[[1]]).length>>1)}
function prepM(G,c,m){const{C:KC,H:KH,W:KW}=G;const W=KW*KC,H=KH*KC;c.width=W+2*m*KC;c.height=H+2*m*KC;const x=c.getContext('2d');
 x.clearRect(0,0,c.width,c.height);x.font=KC*.4+'px monospace';x.textAlign='center';x.textBaseline='middle';
 x.fillStyle='#fff';x.fillRect(m*KC,m*KC,W,H);x.strokeStyle='#8a8f96';x.lineWidth=1;x.strokeRect(m*KC-.5,m*KC-.5,W+1,H+1);x.translate(m*KC,m*KC);return x}
const hooks={render:renderKern,paint:()=>kPaint(),thumb:(c,s)=>isImg(s)?imageMode.thumb(c,s):kThumb(c,s),newSession:newKern,adoptImage:s=>imageMode.adoptImage(s)};
registerTab('kern',hooks);
// shared: what the whole-image mode reuses from the grid mode
return{...hooks,KP,KPW,setImageMode,shared:{KP,KOPS,KOP_LABELS,kFixWt,kHelpers,kInf,kPanels,kSyncPanels}};
})();
