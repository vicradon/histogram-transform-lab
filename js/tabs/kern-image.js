/* ==== 5b. TAB: Kernels & morphology, whole-image mode ================================================= */
// An image pasted, dropped or opened in the kernels tab becomes an image session (k.src === 'image').
// Its steps use the same operation panels as the drawn grid, but each step runs on the whole image when
// you press Apply instead of being stepped cell by cell. Results are cached in memory, never saved:
// a step remembers the settings it was applied with (st.applied) and is recomputed after a reload.
const KernImage=(()=>{
const{imgHm,imgMorph,imgOps,kalg,kFlat,kFmt,kNum,klab,kwt,otsuCalc}=Algos;
const{$,compute,IC,mk,paintImg,save}=Core;
const{KP,kFixWt,kHelpers,kInf,kPanels,kSyncPanels}=KernTab.shared;

const VERB={erode:'erosion',dilate:'dilation',hm:'hit-or-miss',alg:'expression',wt:'weighted scan',label:'labeling',apply:'relabeling'};
const cache=new WeakMap();// session -> Map(step signature -> result {v, kind, tbl?, info, ms})
let el=null;// DOM references of the current render: {src, steps: [...]}

/* ---- session ---- */
function newStep(){return{op:'erode',conn:8,K:KP[1][1].map(r=>r.slice())}}
function adoptImage(s){return{...s,gray:true,k:{src:'image',mode:'gray',thr:null,fg:'bright',pad:'ignore',in1s:'1',in0s:'0',steps:[newStep()]}}}
function thumb(c,s){if(!s.nodes[0].out)compute(s);paintImg(c,s,s.nodes[0].out)}

/* ---- source image: luminance, optionally thresholded to 0/1 ---- */
const otsuT=s=>{if(!s.nodes[0].h)compute(s);return otsuCalc(s.nodes[0].h).bt};
const thrOf=s=>s.k.thr==null?otsuT(s):s.k.thr;
const srcMemo=new WeakMap();// session -> {out, key, val}: reuse the source array while nothing it depends on changes
function source(s){const k=s.k;if(!s.nodes[0].out)compute(s);
 const key=JSON.stringify([k.mode,k.mode==='bin'?[thrOf(s),k.fg,k.in1s,k.in0s]:0]),m=srcMemo.get(s);
 if(m&&m.out===s.nodes[0].out&&m.key===key)return m.val;
 const val=sourceNow(s);srcMemo.set(s,{out:s.nodes[0].out,key,val});return val}
function sourceNow(s){const k=s.k;
 const o=s.nodes[0].out,N=s.w*s.h,L=new Float64Array(N);for(let i=0;i<N;i++)L[i]=o[i*4];
 if(k.mode!=='bin')return{v:L,kind:kindOf(L),sig:s.pid+'|gray'};
 // foreground (1) = brighter than T, or darker than or equal to T; 1s and 0s can be read as other values (e.g. ∞)
 const t=thrOf(s),dark=k.fg==='dark',v1=kNum(k.in1s||'1'),v0=kNum(k.in0s||'0'),v=new Float64Array(N);
 for(let i=0;i<N;i++)v[i]=(dark?L[i]<=t:L[i]>t)?v1:v0;
 return{v,kind:kindOf(v),sig:s.pid+'|'+JSON.stringify(['bin',t,k.fg,k.in1s||'1',k.in0s||'0'])}}
// bin: only 0 and 1; gray: within 0..255; num: anything else (e.g. distances with ∞); lab: label images
function kindOf(v,op){if(op==='label'||op==='apply')return'lab';let bin=true,byte=true;
 for(let i=0;i<v.length&&(bin||byte);i++){const x=v[i];if(x!==0&&x!==1)bin=false;if(!(x>=0&&x<=255))byte=false}
 return bin?'bin':byte?'gray':'num'}

/* ---- running a step on the whole image ---- */
// Returns a reason the step cannot run on this input, or ''.
function blocker(st,inp){
 if(st.op==='hm'&&inp.kind!=='bin')return'Hit-or-miss needs a binary (0/1) image: set the source to Binary, or run it after a step whose result is binary.';
 if(st.op==='label'&&inp.kind!=='bin')return'Labeling needs a binary (0/1) image: set the source to Binary.';
 if(st.op==='apply'&&!inp.tbl)return'This step needs a correspondence table: put a Sequential labeling step right before it.';
 if(st.op==='alg'){const r=kalg({W:1,H:1},st.expr||'A',new Float64Array(1),st.K,imgOps({W:1,H:1},st.K,1,'zero'));if(r.err)return'Expression: '+r.err}
 return''}
function runStep(s,st,inp){const G={W:s.w,H:s.h},K=st.K,pad=s.k.pad,t0=performance.now(),done=(v,extra)=>({v,kind:kindOf(v,st.op),ms:Math.round(performance.now()-t0),...extra});
 switch(st.op){
  case 'erode':case 'dilate':return done(imgMorph(G,inp.v,K,st.op==='erode'?'e':'d',pad));
  case 'hm':return done(imgHm(G,inp.v,K,pad));
  case 'alg':return done(kalg(G,st.expr||'A',inp.v,K,imgOps(G,K,inp.kind==='bin'?1:255,pad)).v);
  case 'wt':return done(kwt(G,inp.v,st),{info:inp.kind==='bin'?'Tip: for a distance transform set "1s read as" to ∞ in the source card, then add a step with the backward kernel.':''});
  case 'label':{const F=klab(G,inp.v,st),n=F.T.length-1,T=kFlat(F.T,n),c=new Set(T.slice(1)).size;
   return done(F.E,{tbl:T,info:`${n} provisional label${n===1?'':'s'}; the table resolves them to ${c} component${c===1?'':'s'}. Add a "Relabel through table" step to see the final labels.`})}
  case 'apply':{const T=inp.tbl,v=inp.v.map(x=>x?(T[x]!=null?T[x]:x):0),c=new Set(T.slice(1)).size;
   return done(v,{info:`${c} connected component${c===1?'':'s'}.`})}}}
const stepKey=(s,st)=>JSON.stringify([st.op,st.K,st.Wt,st.red,st.seq,st.dx,st.dy,st.expr,st.conn,s.k.pad]);
// Walks the steps. Each step's signature covers the source and every setting above it, so changing anything
// upstream makes the steps below out of date. applyTo = index of the step whose Apply was pressed: it and every
// out-of-date step above it are (re)computed. Steps applied earlier with unchanged settings are recomputed
// silently when their result is not in memory (after a reload).
function evaluate(s,applyTo=-1){const m=cache.get(s)||new Map();cache.set(s,m);
 const src=source(s),rows=[];let prev={...src,fresh:true};
 s.k.steps.forEach((st,i)=>{kFixWt(st);if(st.expr==null)st.expr='A − (A ⊖ B)';
  const sig=prev.sig+'>'+stepKey(s,st),want=i<=applyTo,why=prev.fresh?blocker(st,prev):'';
  let res=m.get(sig);
  if(!res&&prev.fresh&&!why&&(want||st.applied===sig)){res=runStep(s,st,prev);m.set(sig,res)}
  if(want&&res)st.applied=sig;
  const fresh=!!res&&st.applied===sig,shown=fresh?res:(st.applied&&m.get(st.applied))||null;
  rows.push({st,sig,input:prev,fresh,shown,why});
  prev=fresh?{...res,sig,fresh:true}:{v:shown&&shown.v,kind:shown&&shown.kind,sig,fresh:false}});
 // keep only results that are on screen
 const keep=new Set(rows.flatMap(r=>[r.sig,r.st.applied]));for(const key of m.keys())if(!keep.has(key))m.delete(key);
 return{src,rows}}

/* ---- drawing value arrays into canvases ---- */
const HUE=new Map();
function labColor(v){let c=HUE.get(v);if(c)return c;const h=(v*67)%360/60,s=.65,l=.6,a=s*Math.min(l,1-l),
 f=n=>{const k=(n+h)%6;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,4-k,1))))};c=[f(5),f(3),f(1)];HUE.set(v,c);return c}
// stretch (display only): map the result's own min..max to black..white
function draw(c,w,h,v,kind,stale,stretch){c.classList.toggle('stale',!!stale);c.style.imageRendering=w<400?'pixelated':'auto';
 if(stretch&&kind==='gray')kind='num';
 if(c._v===v&&c._k===kind&&c.width===w)return;c._v=v;c._k=kind;c.width=w;c.height=h;const x=c.getContext('2d');
 if(!v){x.clearRect(0,0,w,h);return}
 const img=new ImageData(w,h),d=img.data;let lo=Infinity,hi=-Infinity;
 if(kind==='num')for(const q of v)if(isFinite(q)){if(q<lo)lo=q;if(q>hi)hi=q}
 const span=hi>lo?hi-lo:1;
 for(let i=0;i<v.length;i++){const q=v[i],p=i*4;let r,g,b;
  if(kind==='lab'){if(!q)r=g=b=0;else[r,g,b]=labColor(q)}
  else if(kind==='bin')r=g=b=q?255:0;
  else if(kind==='gray')r=g=b=q;
  else if(isFinite(q))r=g=b=Math.round((q-lo)/span*255);
  else[r,g,b]=q>0?[120,170,215]:[215,140,120];// +∞ blue, -∞ red
  d[p]=r;d[p+1]=g;d[p+2]=b;d[p+3]=255}
 x.putImageData(img,0,0)}
const fmtVal=(v,kind)=>v==null?'–':kind==='lab'?(v?'label '+v:'background'):kFmt(v);

/* ---- rendering ---- */
function render(){const s=App.cur,k=s.k,m=$('main');m.innerHTML='';el={steps:[]};
 m.append(sourceCard(s,k));
 k.steps.forEach((st,i)=>m.append(stepCard(s,k,st,i)))}
function sourceCard(s,k){const E=el.src={segs:[]},{sel,seg,grp,btn}=kHelpers(E),c=mk('section','card');
 const h=mk('h2','','Source image');E.size=mk('span','cap');h.append(E.size);
 const mode=sel([['gray','Grayscale (0 to 255)'],['bin','Binary (threshold)']]);mode.value=k.mode;mode.onchange=()=>{k.mode=mode.value;paint();renderSrcVisibility()};
 E.thr=document.createElement('input');E.thr.type='range';E.thr.min=0;E.thr.max=255;E.thr.style.width='180px';
 E.thrVal=mk('b','');E.thrVal.style.cssText='min-width:96px;white-space:nowrap';E.thr.oninput=()=>{k.thr=+E.thr.value;paint()};
 E.otsu=btn('Otsu',()=>{k.thr=null;paint()},'chip');E.otsu.style.whiteSpace='nowrap';
 const fg=sel([['bright','Brighter than T'],['dark','Darker than or at T']]);fg.value=k.fg;fg.onchange=()=>{k.fg=fg.value;paint()};
 const pad=sel([['ignore','Ignored'],['zero','Counted as 0']]);pad.value=k.pad;pad.onchange=()=>{k.pad=pad.value;paint()};
 const tr=mk('div','row');tr.style.alignItems='center';tr.style.gap='8px';tr.append(E.thr,E.thrVal,E.otsu);
 const fld=(lab,key)=>{const l=mk('label','sw',`${lab} <input type='text' class='sq'>`),inp=l.querySelector('input'),b=btn('∞',()=>{k[key]='∞';inp.value='∞';paint()});b.title='Use ∞';
  inp.value=k[key]||(key==='in1s'?'1':'0');inp.oninput=()=>kInf(inp);inp.onchange=()=>{k[key]=inp.value.trim()||(key==='in1s'?'1':'0');paint()};
  const g=mk('div','row');g.style.cssText='gap:6px;align-items:center';g.append(l,b);return g};
 E.binOnly=[grp('Threshold T',tr),grp('Foreground (1)',seg(fg,['Brighter than T','Darker than or at T']).el),grp('Values',(()=>{const r=mk('div','row');r.style.gap='10px';r.append(fld('1s read as','in1s'),fld('0s read as','in0s'));return r})())];
 const r=mk('div','row');r.style.alignItems='flex-end';
 r.append(grp('Input',seg(mode,['Grayscale','Binary']).el),...E.binOnly,grp('Pixels outside the image',seg(pad,['Ignored','Counted as 0']).el),mode,fg,pad);
 c.append(h,r,mk('div','cap','Color images are converted to luminance. Each step runs on the whole image when you press Apply; chain steps with the ⋯ menu on a result. "Pixels outside the image" sets how erosion, dilation, hit-or-miss and algebra treat the border.'));
 renderSrcVisibility=()=>E.binOnly.forEach(g=>g.hidden=k.mode!=='bin');renderSrcVisibility();
 return c}
let renderSrcVisibility=()=>{};
function stepCard(s,k,st,i){kFixWt(st);if(st.expr==null)st.expr='A − (A ⊖ B)';if(!st.Tedit)st.Tedit={};
 const Es={segs:[]};el.steps[i]=Es;const{row,btn}=kHelpers(Es),c=mk('section','card');
 const h=mk('h2','',`Step ${i+1}${i?' (input = result of step '+i+')':''}`);
 if(i>0)h.append(mk('span','sp'),btn('Remove this step',()=>{k.steps.length=i;render();paint()}));
 kPanels(Es,st,i,()=>paint());
 // grid-only affordances in the shared panels
 Es.wtDrag.hidden=true;Es.ked.draggable=false;Es.ked.removeAttribute('title');
 const rOp=row();rOp.append(Es.op,Es.opSeg);
 // input (left) and result (right)
 const io=row('margin-top: 10px; align-items: flex-start;'),a=mk('div','kcol'),b=mk('div','kcol');
 Es.inCap=mk('span','cap');Es.inCv=mk('canvas','v kimg');const ih=mk('div','mh');ih.style.minHeight='34px';ih.append(Es.inCap);a.append(ih,Es.inCv);
 const mh=mk('div','mh'),mb=mk('button','ibtn',IC(`<circle cx='5' cy='12' r='1.5'/><circle cx='12' cy='12' r='1.5'/><circle cx='19' cy='12' r='1.5'/>`)),mn=mk('div','menu');
 mb.title='Result options';mb.setAttribute('aria-label','Result options');mn.hidden=true;
 mb.onclick=ev=>{ev.stopPropagation();const o=mn.hidden;document.querySelectorAll('.menu').forEach(z=>z.hidden=true);mn.hidden=!o};
 const chain=btn('Use as input for new operation',()=>{mn.hidden=true;k.steps.length=i+1;k.steps.push(newStep());render();paint();
  el.steps[i+1].card.scrollIntoView({block:'nearest',behavior:'smooth'})});
 const rr=btn('Reset result',()=>{mn.hidden=true;st.applied=null;paint()});rr.title='Forget this result; press Apply to run it again';
 mn.append(chain,rr);mh.style.minHeight='34px';
 Es.stretch=btn('Stretch contrast',()=>{st.stretch=!st.stretch;paint()},'chip');Es.stretch.title='Display only: map this result\'s darkest value to black and brightest to white (the values themselves do not change)';
 const sp=mk('span','');sp.style.cssText='display:flex;gap:6px;align-items:center';sp.append(Es.stretch,mb);
 mh.append(mk('span','cap','Result'),sp,mn);Es.outCv=mk('canvas','v kimg');b.append(mh,Es.outCv);
 io.append(a,b);
 // Apply, status and the pixel readout
 const ft=mk('div','kfoot');Es.apply=btn('Apply',()=>applyStep(i),'primary');Es.status=mk('span','cap');Es.probe=mk('span','cap kprobe');
 ft.append(Es.apply,Es.status);
 [Es.inCv,Es.outCv].forEach(cv=>{cv.onmousemove=e=>probe(Es,cv,e);cv.onmouseleave=()=>{Es.probe.textContent=''}});
 c.append(h,rOp,Es.alg,Es.lab,Es.r2,Es.wt,io,ft,Es.probe);Es.card=c;
 return c}
function probe(Es,cv,e){const r=cv.getBoundingClientRect(),w=cv.width,hh=cv.height;if(!Es.row||!w)return;
 const x=Math.min(w-1,Math.floor((e.clientX-r.left)/r.width*w)),y=Math.min(hh-1,Math.floor((e.clientY-r.top)/r.height*hh)),j=y*w+x,R=Es.row;
 const iv=R.input.v?R.input.v[j]:null,ov=R.shown?R.shown.v[j]:null;
 Es.probe.textContent=`Pixel (${x}, ${y}): input ${fmtVal(iv,R.input.kind)}`+(R.shown?` → result ${fmtVal(ov,R.shown.kind)}${R.fresh?'':' (out of date)'}`:'')}
function applyStep(i){const Es=el.steps[i];Es.apply.disabled=true;Es.status.textContent='Working…';
 setTimeout(()=>{try{evaluate(App.cur,i)}finally{paint()}},20)}

/* ---- painting ---- */
function paint(){const s=App.cur;if(!s||!el||App.tab!=='kern')return;save();
 const k=s.k,{rows}=evaluate(s),E=el.src,t=thrOf(s);
 E.size.textContent=`${s.w} x ${s.h} px`;E.segs.forEach(f=>f());
 E.thr.value=t;E.thrVal.textContent=k.thr==null?`T = ${t} (Otsu)`:`T = ${t}`;E.otsu.title=`Use this image's Otsu threshold (T = ${otsuT(s)})`;E.otsu.setAttribute('aria-pressed',k.thr==null);
 rows.forEach((R,i)=>{const Es=el.steps[i];if(!Es)return;Es.row=R;const st=R.st,name=VERB[st.op];
  kSyncPanels(Es,st,true);
  Es.lmsg.textContent='';Es.err.textContent=st.op==='alg'&&R.why?R.why.replace(/^Expression: /,''):'';
  // input canvas: the source, or the previous step's result (dimmed when that is out of date)
  Es.inCap.textContent=i?`Input: result of step ${i}`+(R.input.fresh?'':R.input.v?' (out of date)':' (not applied yet)'):(k.mode==='bin'?'Input: source, thresholded':'Input: source, luminance');
  draw(Es.inCv,s.w,s.h,R.input.v,R.input.kind,!R.input.fresh);
  draw(Es.outCv,s.w,s.h,R.shown&&R.shown.v,R.shown&&R.shown.kind,!R.fresh,st.stretch);
  Es.stretch.setAttribute('aria-pressed',!!st.stretch);Es.stretch.hidden=!(R.shown&&R.shown.kind==='gray');
  Es.apply.textContent=`Apply ${name}`;Es.apply.title=`Run ${name} on the whole image`+(i?' (and any out-of-date step above)':'');
  Es.apply.disabled=!!R.why;
  Es.status.classList.toggle('kerr',!!R.why);
  Es.status.textContent=R.why?R.why
   :R.fresh?[`Done in ${R.shown.ms} ms.`,R.shown.info].filter(Boolean).join(' ')
   :R.shown?'Settings changed since the last Apply: the result shown is out of date.'
   :!R.input.fresh&&i?`Press Apply to run step ${i} and then ${name}.`
   :`Press Apply to run ${name} on the whole image.`});
 }

KernTab.setImageMode({render,paint,thumb,adoptImage});
return{render,paint,source,evaluate,kindOf};
})();
