/* ==== 1. ALGOS: pure math, no DOM ===================================================================== */
const Algos=(()=>{
const cdfOf=h=>{if(h._c)return h._c;const N=h.reduce((a,b)=>a+b,0)||1;let s=0,mn=0;const c=new Array(256);for(let i=0;i<256;i++){s+=h[i];c[i]=s;if(!mn&&s)mn=s}return h._c=c.map(v=>N===mn?0:Math.max(0,(v-mn)/(N-mn)*255))};
const meanOf=h=>{if(h._m!=null)return h._m;let n=0,s=0;h.forEach((v,i)=>{n+=v;s+=v*i});return h._m=n?s/n:128};
const lohi=(h,q)=>{const k='_l'+q;if(h[k])return h[k];const N=h.reduce((a,b)=>a+b,0),t=N*q/100;let s=0,lo=0,hi=255;for(let i=0;i<256;i++){s+=h[i];if(s>t){lo=i;break}}s=0;for(let i=255;i>=0;i--){s+=h[i];if(s>t){hi=i;break}}return h[k]=[lo,hi]};
const SF=(r,p)=>p.B<=p.A?(r<p.A?p.va:p.vb):r<=p.A?p.va:r>=p.B?p.vb:p.va+(r-p.A)*(p.vb-p.va)/(p.B-p.A);
const RP=(a,b)=>[['A','A',0,255,1,a],['B','B',0,255,1,b],['d','Δ',-255,255,1,0],['o','Out',0,2,1,0,'sel',['Black','Keep original','Fixed level']],['v','Lvl',0,255,1,0]];
const RF=(r,p)=>r>=p.A&&r<=p.B?r+p.d:(p.o===0?0:p.o===1?r:p.v);
const TR={
 linear:{n:'Linear (identity)',p:[],f:r=>r},
 section:{n:'Linear section',p:[['A','A',0,255,1,64],['B','B',0,255,1,160],['h','Δ',-255,255,1,70]],f:(r,p)=>r>=p.A&&r<=p.B?r+p.h:r},
 negative:{n:'Negative',p:[],f:r=>255-r},
 log:{n:'Log',p:[],f:r=>255*Math.log(1+r)/Math.log(256)},
 invlog:{n:'Inverse log (exponential)',p:[],f:r=>255*(Math.pow(256,r/255)-1)/255},
 gamma:{n:'Gamma',p:[['g','γ',-140,140,1,-35,'log']],f:(r,p)=>255*Math.pow(r/255,p.g)},
 nroot:{n:'nth root',p:[['n','n',1,10,.1,2]],f:(r,p)=>255*Math.pow(r/255,1/p.n)},
 npower:{n:'nth power',p:[['n','n',1,10,.1,2]],f:(r,p)=>255*Math.pow(r/255,p.n)},
 binary:{n:'Binary',p:[['t','T',0,255,1,128],['h','H',0,255,1,255]],f:(r,p)=>r>=p.t?p.h:0},
 range:{n:'Range keep (L1: A–B)',p:RP(80,160),f:RF},
 rangeHi:{n:'Keep above A (L2)',p:RP(100,255),f:RF},
 rangeLo:{n:'Keep below B (L3)',p:RP(0,160),f:RF},
 equalize:{n:'Histogram equalization',p:[],f:(r,p,h)=>h?cdfOf(h)[r]:r},
 autostretch:{n:'Auto stretch (min to max)',p:[['q','clip',0,20,.5,0]],f:(r,p,h)=>{if(!h)return r;const[lo,hi]=lohi(h,p.q);return hi<=lo?r:r<=lo?0:r>=hi?255:(r-lo)*255/(hi-lo)}},
 squeeze:{n:'Contrast squeeze',p:[['A','a',0,255,1,0],['B','b',0,255,1,255],['va','v_a',0,255,1,70],['vb','v_b',0,255,1,185]],f:SF},
 centershift:{n:'Center shift (move the mean)',p:[['c','C',0,255,1,128]],f:(r,p,h)=>r+(p.c-(h?meanOf(h):p.c))},
 stretch:{n:'Contrast stretch (clipped ramp)',p:[['A','a',0,255,1,70],['B','b',0,255,1,150],['va','v_a',0,255,1,0],['vb','v_b',0,255,1,180]],
  f:(r,p)=>p.B<=p.A?(r<p.A?p.va:p.vb):r<=p.A?p.va:r>=p.B?p.vb:p.va+(r-p.A)*(p.vb-p.va)/(p.B-p.A)},
 bsection:{n:'Binary section',p:[['A','A',0,255,1,80],['B','B',0,255,1,170],['h','H',0,255,1,255]],f:(r,p)=>r>=p.A&&r<=p.B?p.h:0}
};
const gv=v=>Math.pow(10,v/100); // gamma slider -> value (0.04..25)
function lum(d,i){return Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2])}
function hist(d){const h=new Array(256).fill(0);for(let i=0;i<d.length;i+=4)h[lum(d,i)]++;return h}
function toGray(d){const o=new Uint8ClampedArray(d.length);for(let i=0;i<d.length;i+=4){const y=lum(d,i);o[i]=o[i+1]=o[i+2]=y;o[i+3]=d[i+3]}return o}
function lutOf(n){const t=TR[n.type],p={};t.p.forEach(s=>{p[s[0]]=s[6]==='log'?gv(n.v[s[0]]):n.v[s[0]]});
 const l=new Uint8Array(256);for(let r=0;r<256;r++)l[r]=Math.max(0,Math.min(255,Math.round(t.f(r,p,n.inH))));return l}
function applyLut(d,l){const o=new Uint8ClampedArray(d.length);for(let i=0;i<d.length;i+=4){o[i]=l[d[i]];o[i+1]=l[d[i+1]];o[i+2]=l[d[i+2]];o[i+3]=d[i+3]}return o}
const bitLut=k=>{const l=new Uint8Array(256);for(let r=0;r<256;r++)l[r]=(r>>(k-1))&1?255:0;return l};
const maskLut=(m,norm)=>{const l=new Uint8Array(256);if(m)for(let r=0;r<256;r++)l[r]=norm?Math.round((r&m)*255/m):r&m;return l};
const lumLut=(d,l)=>{const o=new Uint8ClampedArray(d.length);for(let i=0;i<d.length;i+=4){const v=l[lum(d,i)];o[i]=o[i+1]=o[i+2]=v;o[i+3]=d[i+3]}return o};
const kIn=(G,x,y)=>x>=0&&y>=0&&x<G.W&&y<G.H;
function kbox(sh){if(sh.t==='free'){const X=sh.pts.map(p=>p[0]),Y=sh.pts.map(p=>p[1]);return[Math.min(...X),Math.min(...Y),Math.max(...X),Math.max(...Y)]}
 return[Math.min(sh.a[0],sh.b[0]),Math.min(sh.a[1],sh.b[1]),Math.max(sh.a[0],sh.b[0]),Math.max(sh.a[1],sh.b[1])]}
function kcells(G,sh){const{H:KH,W:KW}=G;
 const out=new Uint8Array(KW*KH),put=(x,y)=>{if(kIn(G,x,y))out[y*KW+x]=1};
 if(sh.t==='free'){const P=sh.pts;for(let i=0;i<P.length;i++){const[x0,y0]=P[i],[x1,y1]=P[i+1]||P[i],n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);
  for(let j=0;j<=n;j++)put(Math.round(x0+(x1-x0)*j/n),Math.round(y0+(y1-y0)*j/n))}return out}
 const[x0,y0,x1,y1]=kbox(sh),cx=(x0+x1+1)/2,cy=(y0+y1+1)/2,rx=(x1-x0+1)/2,ry=(y1-y0+1)/2;
 const inn=(x,y,ax,ay)=>{if(ax<=0||ay<=0)return false;const u=Math.abs(x+.5-cx)/ax,v=Math.abs(y+.5-cy)/ay;return sh.t==='ellipse'?u*u+v*v<=1:sh.t==='diamond'?u+v<=1:u<=1&&v<=1};
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(inn(x,y,rx,ry)&&(sh.fill||!inn(x,y,rx-1,ry-1)))put(x,y);
 return out}
function kraster(G,k){const{H:KH,W:KW}=G;const g=new Uint8Array(KW*KH);k.shapes.forEach(sh=>{const c=kcells(G,sh);for(let i=0;i<c.length;i++)if(c[i])g[i]=1});return g}
function kmorph(G,g,K,mode){const{H:KH,W:KW}=G;const n=K.length,r=n>>1,o=new Uint8Array(g.length),has=K.some(row=>row.includes(1));
 for(let y=0;y<KH;y++)for(let x=0;x<KW;x++){let ok=has,any=false;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){if(K[j][i]!==1)continue;const dx=i-r,dy=j-r,e=mode==='e',xx=e?x+dx:x-dx,yy=e?y+dy:y-dy,v=kIn(G,xx,yy)&&g[yy*KW+xx]===1;if(e&&!v)ok=false;if(!e&&v)any=true}
  o[y*KW+x]=mode==='e'?(ok?1:0):(any?1:0)}
 return o}
function khm(G,g,K){const{H:KH,W:KW}=G;const n=K.length,r=n>>1,o=new Uint8Array(g.length);
 for(let y=0;y<KH;y++)for(let x=0;x<KW;x++){let ok=true,cnt=0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const c=K[j][i];if(c<0)continue;cnt++;const xx=x+i-r,yy=y+j-r;if((kIn(G,xx,yy)?g[yy*KW+xx]:0)!==c)ok=false}
  o[y*KW+x]=ok&&cnt?1:0}
 return o}
function kout(G,k,g){const K=k.K;
 switch(k.op){case 'dilate':return{t:'bin',v:kmorph(G,g,K,'d')};case 'hm':return{t:'bin',v:khm(G,g,K)};default:return{t:'bin',v:kmorph(G,g,K,'e')}}}
function kEff(k){return k.op==='label'?(k.conn===8?[[1,1,1],[1,1,-1],[-1,-1,-1]]:[[-1,1,-1],[1,1,-1],[-1,-1,-1]]):k.K}
const kCl=(v,a,b)=>Math.max(a,Math.min(b,v));
// The grid a kernels session works on: W x H cells drawn C pixels wide. Kernel functions take it as
// their first argument (and alias it locally as KW, KH, KC) instead of reading globals.
function kGrid(k){return{W:k.W,H:k.H,C:Math.max(10,Math.min(40,Math.floor(480/Math.max(k.W,k.H))))}}
function kimg(G,k){const{W:KW}=G;const g=kraster(G,k);for(const key in k.px){const[a,b]=key.split(',').map(Number);if(kIn(G,a,b))g[b*KW+a]=k.px[key]===1?1:0}return g}
const kNum=s=>{s=String(s).trim();if(/^-\s*(inf|∞)/i.test(s))return -Infinity;if(/^\+?\s*(inf|∞)/i.test(s))return Infinity;return s===''||isNaN(+s)?0:+s};
const kFmt=v=>v===Infinity?'∞':v===-Infinity?'-∞':String(+v.toFixed(2));
const kSI=(G,st,x,y)=>(st.dy==='bt'?G.H-1-y:y)*G.W+(st.dx==='rl'?G.W-1-x:x);
const kSP=(G,st,i)=>{const ty=(i/G.W)|0,tx=i%G.W;return[st.dx==='rl'?G.W-1-tx:tx,st.dy==='bt'?G.H-1-ty:ty]};
function kwt(G,inp,st,lim){const{H:KH,W:KW}=G;const n=st.Wt.length,r=n>>1,mn=st.red!=='max',o=Float64Array.from(inp),src=st.seq?o:inp,N=KW*KH;if(lim==null)lim=N-1;
 for(let t=0;t<=lim&&t<N;t++){const[x,y]=kSP(G,st,t);let best=null;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const w=st.Wt[j][i];if(w==null)continue;const xx=x+i-r,yy=y+j-r;if(!kIn(G,xx,yy))continue;const v=src[yy*KW+xx]+w;if(best===null||(mn?v<best:v>best))best=v}
  if(best!==null)o[y*KW+x]=best}
 return o}
function kalg(G,src,A,K){
 const S='AB()\u2296\u2295\u2218\u2022\u2229\u222a\u2212\u1d9c',tk=[...src.replace(/\s+/g,'')].map(c=>/[ab]/i.test(c)?c.toUpperCase():c);let p=0;
 const E=m=>{throw new Error(m)};
 const atom=()=>{const c=tk[p];if(c==='A'){p++;return{img:A}}if(c==='B'){p++;return{se:1}}if(c==='('){p++;const v=expr();if(tk[p]!==')')E('missing )');p++;return v}E(c?'unexpected '+c:'the expression ends too early')};
 const post=()=>{let v=atom();while(tk[p]==='\u1d9c'){p++;if(!v.img)E('complement needs an image');v={img:v.img.map(x=>x?0:1)}}return v};
 const mor=()=>{let v=post();while('\u2296\u2295\u2218\u2022'.includes(tk[p]||'#')){const o=tk[p++],r=post();if(!v.img)E('left of '+o+' must be an image');if(!r.se)E('right of '+o+' must be B');
  v={img:o==='\u2296'?kmorph(G,v.img,K,'e'):o==='\u2295'?kmorph(G,v.img,K,'d'):o==='\u2218'?kmorph(G,kmorph(G,v.img,K,'e'),K,'d'):kmorph(G,kmorph(G,v.img,K,'d'),K,'e')}}return v};
 const term=()=>{let v=mor();while(tk[p]==='\u2229'){p++;const r=mor();if(!v.img||!r.img)E('\u2229 needs two images');v={img:v.img.map((x,i)=>x&&r.img[i]?1:0)}}return v};
 const expr=()=>{let v=term();while(tk[p]==='\u222a'||tk[p]==='\u2212'){const o=tk[p++],r=term();if(!v.img||!r.img)E(o+' needs two images');v={img:v.img.map((x,i)=>o==='\u222a'?(x||r.img[i]?1:0):(x&&!r.img[i]?1:0))}}return v};
 try{for(const c of tk)if(!S.includes(c))E('unknown symbol '+c);if(!tk.length)E('type an expression');const v=expr();if(p<tk.length)E('unexpected '+tk[p]);if(!v.img)E('the result must be an image, not B');return{v:v.img}}catch(e){return{err:e.message}}}
function klab(G,inp,st,lim){const{H:KH,W:KW}=G;const N=KW*KH,E=new Float64Array(N),T=[0],pre=st.conn===8?[[-1,0],[0,-1],[-1,-1],[1,-1]]:[[-1,0],[0,-1]],lm=lim==null?N-1:lim;let k=1;
 for(let t=0;t<=lm&&t<N;t++){const x=t%KW,y=(t/KW)|0;if(!inp[t])continue;const P=[];
  for(const[dx,dy]of pre){const xx=x+dx,yy=y+dy;if(kIn(G,xx,yy)&&inp[yy*KW+xx]&&E[yy*KW+xx])P.push(E[yy*KW+xx])}
  if(!P.length){E[t]=k;T[k]=k;k++}
  else{const e=Math.min(...P.map(l=>T[l]));E[t]=e;for(let mu of P){let g=0;while(T[mu]!==e&&g++<999){const m=T[mu];T[mu]=e;mu=m}}}}
 return{E,T,k}}
// Each op turns this step's input into {full, part, lim, tblOut, tblPart}.
// full = whole result, part = result revealed so far (sequential ops), lim = last scanned index.
const kBin=input=>Uint8Array.from(input,v=>v>0?1:0);
const kFlat=(T,w)=>{const U=T.slice();for(let l=1;l<=w&&l<U.length;l++){let m=l,g=0;while(U[m]!==m&&g++<999)m=U[m];U[l]=m}return U};
const kWithEdits=(st,T)=>{const ov=st.Tedit||{},U=T.slice();for(const l in ov)if(+l>=1&&+l<U.length)U[+l]=ov[l];return U};
function otsuCalc(h){const N=h.reduce((a,b)=>a+b,0)||1,p=Array.from(h,v=>v/N);let mt=0;for(let i=0;i<256;i++)mt+=i*p[i];
 const w0=[],m0=[],sb=[];let cw=0,cm=0,best=-1,bt=0;
 for(let t=0;t<256;t++){cw+=p[t];cm+=t*p[t];w0[t]=cw;m0[t]=cw>0?cm/cw:0;const w1=1-cw,m1=w1>1e-12?(mt-cm)/w1:0;sb[t]=cw>1e-12&&w1>1e-12?cw*w1*(m0[t]-m1)**2:0;if(sb[t]>best){best=sb[t];bt=t}}
 let vt=0;for(let i=0;i<256;i++)vt+=(i-mt)**2*p[i];
 return{p,w0,m0,sb,bt,best,mt,vt}}
function isodata(o){let t=Math.round(o.mt),it=0;const seen=[t];
 while(it<100){const w=o.w0[t],m0=o.m0[t],m1=w<1-1e-12?(o.mt-w*m0)/(1-w):m0,nt=Math.round((m0+m1)/2);if(nt===t)break;t=nt;it++;seen.push(t)}
 return{t,it,seen}}
return{applyLut,bitLut,cdfOf,gv,hist,isodata,kalg,kBin,kbox,kcells,kCl,kEff,kFlat,kFmt,kGrid,khm,kimg,kIn,klab,kmorph,
 kNum,kout,kraster,kSI,kSP,kWithEdits,kwt,lohi,lum,lumLut,lutOf,maskLut,meanOf,otsuCalc,toGray,TR};
})();
