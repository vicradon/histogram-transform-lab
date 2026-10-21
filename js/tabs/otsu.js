/* ==== 6. TAB: Otsu threshold ========================================================================== */
const OtsuTab=(()=>{
const{isodata,lum,otsuCalc}=Algos;
const{$,emptyState,IC,mk,paintImg,registerTab,save}=Core;

let oE=null,otPlay=0;
const TXC={};
function txc(q){const k=(window.mjReady?1:0)+q;return TXC[k]||(TXC[k]=tx(q))}
const cssv=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function otAxes(x,W,H,top,mut){const bw=W/256;x.save();x.fillStyle=mut;x.strokeStyle=mut;x.font='11px sans-serif';x.lineWidth=1;x.textBaseline='alphabetic';
 [0,64,128,192,255].forEach(v=>{const X=(v+.5)*bw;x.beginPath();x.moveTo(X,H-18);x.lineTo(X,H-14);x.stroke();x.textAlign=v===0?'left':v===255?'right':'center';x.fillText(v,v===0?2:v===255?W-2:X,H-3)});
 x.textAlign='left';x.fillText('0',3,H-21);if(top!=null)x.fillText(top,3,11);x.restore()}
function otWrap(E,cv,k){if(!E.ov)E.ov=[];
 const w=mk('div','owrap'),ov=document.createElement('canvas'),tip=mk('div','otip');tip.hidden=true;
 ov.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';E.ov[k]=ov;
 w.style.cssText='position:relative;width:100%;max-width:640px;touch-action:pan-y';w.append(cv,ov,tip);
 w.onpointermove=e=>{const r=w.getBoundingClientRect(),i=Math.max(0,Math.min(255,Math.floor((e.clientX-r.left)/r.width*256)));otHover(E,i,w,tip,e.clientX-r.left,k)};
 w.onpointerleave=()=>{E.ov.forEach(o=>{o.width=o.width});w.querySelector('.otip').hidden=true};
 return w}
function otHover(E,i,w,tip,px,k){const L=E.last;if(!L)return;const{o,h}=L,f=(v,k=3)=>(+v).toFixed(k);
 E.ov.forEach((ov,j)=>{const W=512,H=j?120:170;ov.width=W;ov.height=H;const x=ov.getContext('2d'),X=(i+.5)*W/256;
  x.strokeStyle=cssv('--ink');x.globalAlpha=.55;x.lineWidth=1;x.beginPath();x.moveTo(X,0);x.lineTo(X,H-18);x.stroke();x.globalAlpha=1;
  if(j){x.fillStyle=cssv('--curve');x.beginPath();x.arc(X,H-18-(j===1?o.w0[i]:(o.best>0?o.sb[i]/o.best:0))*(H-30),4.5,0,7);x.fill()}});
 const cum=h.slice(0,i+1).reduce((a,b)=>a+b,0);
 tip.innerHTML=k===0?`<b>Gray level ${i}</b><br>${h[i].toLocaleString()} pixel${h[i]===1?'':'s'}`:k===1?`<b>${txc('t')} = ${i}</b><br>${txc('\\omega_0')} = <b>${f(o.w0[i],3)}</b> (${cum.toLocaleString()} pixels up to here)`:`<b>${txc('t')} = ${i}</b><br>${txc('\\sigma_B^2')} = <b>${f(o.sb[i],1)}</b>${i===o.bt?' (Otsu optimum)':''}`;
 tip.hidden=false;const tw=tip.offsetWidth;tip.style.left=(px+14+tw>w.clientWidth?Math.max(0,px-14-tw):px+14)+'px'}
window.addEventListener('resize',()=>{if(App.tab==='otsu')paintOtsu()});
function renderOtsu(){
 const m=$('main');m.innerHTML='';clearInterval(otPlay);otPlay=0;oE=null;
 if(emptyState(m,'Click to choose a file, or press Ctrl/Cmd+V anywhere on this page.'))return;
 const s=App.cur,E=oE={};if(!s.ot)s.ot={t:null};
 const c1=mk('section','card',`<h2>Threshold</h2>`),r1=mk('div','row');r1.style.alignItems='center';
 E.sl=document.createElement('input');E.sl.type='range';E.sl.min=0;E.sl.max=255;E.sl.style.cssText='flex:1 1 260px;accent-color:var(--acc)';
 E.sl.oninput=()=>{clearInterval(otPlay);s.ot.t=+E.sl.value;paintOtsu()};
 const mv=d=>{const o=otsuCalc(s.nodes[0].h),t=s.ot.t==null?o.bt:s.ot.t;s.ot.t=Math.max(0,Math.min(255,t+d));paintOtsu()};
 const b=(l,f,ic)=>{const x=mk('button',ic?'ibtn':'',ic?IC(ic):l);x.title=l;x.setAttribute('aria-label',l);x.onclick=f;return x};
 E.tv=mk('b','');E.tv.style.cssText='font:600 18px monospace;min-width:3ch';
 E.play=b('Play the search',()=>{if(otPlay){clearInterval(otPlay);otPlay=0;paintOtsu();return}s.ot.t=0;paintOtsu();
  otPlay=setInterval(()=>{if(s.ot.t>=255){clearInterval(otPlay);otPlay=0;s.ot.t=null}else s.ot.t++;paintOtsu()},45);paintOtsu()});
 r1.append(mk('span','cap','t ='),E.tv,E.sl,b('Previous threshold',()=>{clearInterval(otPlay);otPlay=0;mv(-1)},`<path d='M19 12H5M11 6l-6 6 6 6'/>`),b('Next threshold',()=>{clearInterval(otPlay);otPlay=0;mv(1)},`<path d='M5 12h14M13 6l6 6-6 6'/>`),E.play,b('Go to the Otsu optimum',()=>{clearInterval(otPlay);otPlay=0;s.ot.t=null;paintOtsu()}));
 r1.lastChild.textContent='Otsu optimum';r1.lastChild.className='';r1.lastChild.innerHTML='Otsu optimum';
 c1.append(r1);m.append(c1);
 const c2=mk('section','card'),r2=mk('div','row');
 const col=(cap,cv)=>{const d=mk('div','col');d.style.flex='1 1 240px';d.append(mk('div','cap',cap),cv);return d};
 E.src=mk('canvas','v img');E.res=mk('canvas','v img');
 r2.append(col('Input (gray levels)',E.src),col('Thresholded: pixels above t become white',E.res));c2.append(r2);m.append(c2);
 const c3=mk('section','card');E.hc=mk('canvas','v');E.vc=mk('canvas','v');E.cc=mk('canvas','v');E.cc.style.cssText='display:block;width:100%;max-width:640px;height:auto;aspect-ratio:512/120';
 E.hc.style.cssText='display:block;width:100%;max-width:640px;height:auto;aspect-ratio:512/170';E.vc.style.cssText='display:block;width:100%;max-width:640px;height:auto;aspect-ratio:512/120';
 const blk=(title,desc,yl,wrap,xl)=>{const d=mk('div','chart');d.style.margin='6px 0 20px';d.append(mk('div','',`<b>${title}</b>`),mk('div','cap',desc));
  const r=mk('div','');r.style.cssText='display:flex;gap:6px;align-items:stretch;max-width:700px';wrap.style.flex='1 1 auto';r.append(mk('div','ylab',`<span>${yl}</span>`),wrap);d.append(r,mk('div','xlab',xl));return d},
  swt=c=>`<span style='display:inline-block;width:10px;height:10px;border-radius:2px;background:${c};vertical-align:-1px'></span>`;
 c3.append(
  blk('Histogram of gray levels',`${swt('var(--acc)')} ${tx('C_0')}: levels up to ${tx('t')} &nbsp; ${swt('var(--curve)')} ${tx('C_1')}: levels above ${tx('t')} &nbsp; solid line: current ${tx('t')} &nbsp; dashed line: Otsu optimum ${tx('t^{*}')}`,'Number of pixels',otWrap(E,E.hc,0),`Gray level ${tx('i')}`),
  blk('Cumulative distribution (CDF)',`The fraction of pixels with gray level up to ${tx('t')}: ${tx('\\omega_0(t)=\\sum_{i\\le t}p_i')}. It always rises from 0 to 1.`,tx('\\omega_0(t)'),otWrap(E,E.cc,1),`Threshold ${tx('t')} (gray level)`),
  blk('Between-class variance',`${tx('\\sigma_B^2(t)=\\omega_0\\,\\omega_1\\,(\\mu_0-\\mu_1)^2')} for every possible ${tx('t')}. Otsu picks the highest point.`,tx('\\sigma_B^2(t)'),otWrap(E,E.vc,2),`Threshold ${tx('t')} (gray level)`));m.append(c3);
 const c4=mk('section','card'),hd=mk('div','mh');hd.style.marginBottom='8px';E.h4=mk('h2','','Numbers at this threshold');E.h4.style.margin='0';
 const sg=mk('div','seg');E.tabs=[['num','Numbers'],['der','Derivation']].map(([k,l])=>{const b=mk('button','',l);b.onclick=()=>{s.ot.tab=k;paintOtsu()};sg.append(b);return[k,b]});hd.append(E.h4,sg);
 E.pn=mk('div');E.stats=mk('div','ostat');E.note=mk('div','cap');E.note.style.lineHeight='1.6';E.pn.append(E.stats,E.note);E.der=mk('div');c4.append(hd,E.pn,E.der);m.append(c4);
}
function tx(q,d){if(window.mjReady&&window.MathJax&&MathJax.tex2svg){try{return MathJax.tex2svg(q,{display:!!d}).outerHTML}catch(e){}}return '<code>'+q.replace(/</g,'&lt;')+'</code>'}
function paintOtsu(){const s=App.cur,E=oE;if(!s||s.empty||!E||App.tab!=='otsu')return;save();
 const n=s.nodes[0];if(!n.out||!n.h)return;if(!s.ot)s.ot={t:null};
 const o=otsuCalc(n.h),iso=isodata(o),t=s.ot.t==null?o.bt:s.ot.t;E.last={o,h:n.h,t};
 const cs=getComputedStyle(document.documentElement),acc=cs.getPropertyValue('--acc').trim(),crv=cs.getPropertyValue('--curve').trim(),ink=cs.getPropertyValue('--ink').trim(),mut=cs.getPropertyValue('--mut').trim();
 E.sl.value=t;E.tv.textContent=t;E.play.setAttribute('aria-pressed',!!otPlay);
 paintImg(E.src,s,n.out);
 const cw=E.src.parentNode.clientWidth||300,wpx=Math.max(120,Math.min(cw,300*s.w/s.h,640));E.src.style.width=E.res.style.width=wpx+'px';E.src.style.height=E.res.style.height='auto';
 const d=new Uint8ClampedArray(n.out.length);for(let i=0;i<d.length;i+=4){const v=lum(n.out,i)>t?255:0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}paintImg(E.res,s,d);
 let c=E.hc,x=c.getContext('2d');const W=c.width=512,H=c.height=170,bw=W/256,X=v=>(v+.5)*bw,mx=Math.sqrt(Math.max(...n.h)||1);
 x.clearRect(0,0,W,H);
 for(let i=0;i<256;i++){const bh=Math.sqrt(n.h[i])/mx*(H-22);x.globalAlpha=.85;x.fillStyle=i<=t?acc:crv;x.fillRect(i*bw,H-18-bh,bw+.5,bh)}
 x.globalAlpha=1;x.strokeStyle=mut;x.lineWidth=1;x.beginPath();x.moveTo(0,H-17.5);x.lineTo(W,H-17.5);x.stroke();
 
 x.setLineDash([5,4]);x.beginPath();x.moveTo(X(o.bt),0);x.lineTo(X(o.bt),H-18);x.stroke();x.setLineDash([]);
 x.strokeStyle=ink;x.lineWidth=2;x.beginPath();x.moveTo(X(t),0);x.lineTo(X(t),H-18);x.stroke();
 x.fillStyle=ink;x.textAlign=t>200?'right':'left';x.fillText('t = '+t,X(t)+(t>200?-5:5),12);
 c=E.cc;x=c.getContext('2d');const H3=c.height=120;c.width=W;x.clearRect(0,0,W,H3);
 const Yc=v=>H3-18-v*(H3-30);
 x.strokeStyle=mut;x.lineWidth=1;x.globalAlpha=.3;x.beginPath();x.moveTo(0,Yc(.5));x.lineTo(W,Yc(.5));x.moveTo(0,Yc(1));x.lineTo(W,Yc(1));x.stroke();x.globalAlpha=1;
 x.fillStyle=mut;x.font='11px sans-serif';x.textAlign='left';x.fillText('1',2,Yc(1)-3);x.fillText('0.5',2,Yc(.5)-3);
 x.strokeStyle=ink;x.lineWidth=2;x.beginPath();o.w0.forEach((v,i)=>{i?x.lineTo(X(i),Yc(v)):x.moveTo(X(i),Yc(v))});x.stroke();
 x.strokeStyle=mut;x.lineWidth=1;x.beginPath();x.moveTo(0,H3-17.5);x.lineTo(W,H3-17.5);x.stroke();
 
 x.setLineDash([5,4]);x.beginPath();x.moveTo(X(o.bt),0);x.lineTo(X(o.bt),H3-18);x.stroke();x.setLineDash([]);
 x.strokeStyle=ink;x.beginPath();x.moveTo(X(t),0);x.lineTo(X(t),H3-18);x.stroke();
 x.fillStyle=crv;x.beginPath();x.arc(X(t),Yc(o.w0[t]),5,0,7);x.fill();
 x.fillStyle=ink;x.font='11px sans-serif';x.textAlign=t>200?'right':'left';x.fillText(o.w0[t].toFixed(3),X(t)+(t>200?-9:9),Math.max(12,Yc(o.w0[t])-6));
 c=E.vc;x=c.getContext('2d');const H2=c.height=120;c.width=W;x.clearRect(0,0,W,H2);
 const Y=v=>H2-18-(o.best>0?v/o.best:0)*(H2-30);
 x.strokeStyle=ink;x.lineWidth=2;x.beginPath();o.sb.forEach((v,i)=>{i?x.lineTo(X(i),Y(v)):x.moveTo(X(i),Y(v))});x.stroke();
 x.strokeStyle=mut;x.lineWidth=1;x.beginPath();x.moveTo(0,H2-17.5);x.lineTo(W,H2-17.5);x.stroke();
 x.setLineDash([5,4]);x.beginPath();x.moveTo(X(o.bt),0);x.lineTo(X(o.bt),H2-18);x.stroke();x.setLineDash([]);
 x.strokeStyle=ink;x.beginPath();x.moveTo(X(t),0);x.lineTo(X(t),H2-18);x.stroke();
 x.fillStyle=crv;x.beginPath();x.arc(X(t),Y(o.sb[t]),5,0,7);x.fill();
 otAxes(E.hc.getContext('2d'),512,170,Math.max(...n.h).toLocaleString(),mut);otAxes(E.cc.getContext('2d'),512,120,null,mut);otAxes(E.vc.getContext('2d'),512,120,Math.round(o.best).toLocaleString(),mut);
 const w0=o.w0[t],w1=1-w0,mu0=o.m0[t],mu1=w1>1e-12?(o.mt-w0*mu0)/w1:0,sb=o.sb[t],f=(v,k=3)=>(+v).toFixed(k);
 E.stats.innerHTML=[['\\omega_0','class 0 weight',f(w0)],['\\omega_1','class 1 weight',f(w1)],['\\mu_0','class 0 mean',f(mu0,1)],['\\mu_1','class 1 mean',f(mu1,1)],['\\sigma_B^2','between classes',f(sb,1)],['\\sigma_W^2','within classes',f(o.vt-sb,1)],['t^{*}','Otsu optimum',o.bt],['\\sigma_B^2(t^{*})','largest between-class variance',f(o.best,1)]].map(([q,l,v])=>`<div>${tx(q)} <span class='cap'>${l}</span><b>${v}</b></div>`).join('');
 E.note.innerHTML=`${tx('C_0')} = pixels with gray level up to ${tx('t')} (teal in the histogram); ${tx('C_1')} = pixels above ${tx('t')} (red).<br>Otsu tries all 256 thresholds, so it is a search, not a converging loop: ${tx('\\sigma_B^2(t)=\\omega_0\\,\\omega_1\\,(\\mu_0-\\mu_1)^2')}, and the best ${tx('t')} is the one with the largest value (equivalently, the smallest within-class variance).<br>For comparison, iterative selection (ISODATA) starts at the mean and repeats \u201cnew ${tx('t')} = midpoint of the two class means\u201d: here it starts at ${iso.seen[0]}${iso.it?', then goes '+iso.seen.slice(1).join(', '):''} and stops at <b>${iso.t}</b> after ${iso.it} update${iso.it===1?'':'s'}.`;
 const pane=s.ot.tab||'num';E.tabs.forEach(([k,b])=>b.setAttribute('aria-pressed',k===pane));E.pn.hidden=pane!=='num';E.der.hidden=pane!=='der';E.h4.textContent=pane==='num'?'Numbers at this threshold':'How the threshold is picked';
 if(pane==='der'){
  const mom=w0*mu0,N=n.h.reduce((a,b)=>a+b,0),cnt0=n.h.slice(0,t+1).reduce((a,b)=>a+b,0),
   ranked=o.sb.map((v,i)=>[i,v]).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,6),ties=o.sb.filter(v=>v===o.best).length,
   sw=c=>`<span style='display:inline-block;width:11px;height:11px;border-radius:3px;background:${c};vertical-align:-1px'></span>`,
   row=(a,b)=>`<div class='dstep'><span class='dn'>${a}</span><div>${b}</div></div>`;
  E.der.innerHTML=
   row(1,`Turn the histogram into probabilities, with ${tx('N='+N)} pixels in total:${tx('p_i=\\frac{n_i}{N}',1)}`)
  +row(2,`Overall mean and total variance:${tx('\\mu_T=\\sum_{i=0}^{255} i\\,p_i='+f(o.mt,2)+'\\qquad \\sigma_T^2=\\sum_{i=0}^{255}(i-\\mu_T)^2\\,p_i='+f(o.vt,1),1)}`)
  +row(3,`Pick a threshold, here <b>${tx('t='+t)}</b>. It splits the pixels into two classes according to their gray level:${tx('C_0=\\{\\text{pixels with gray level}\\le t\\}',1)}${tx('C_1=\\{\\text{pixels with gray level}>t\\}',1)}<div>${sw('var(--acc)')} ${tx('C_0')} is the darker class (teal in the histogram) and holds <b>${cnt0}</b> pixels.</div><div style='margin-top:4px'>${sw('var(--curve)')} ${tx('C_1')} is the brighter class (red) and holds <b>${N-cnt0}</b> pixels.</div><div style='margin-top:8px'>Each class weight is the fraction of all pixels it holds:</div>${tx('\\omega_0=\\sum_{i\\le t}p_i=\\frac{|C_0|}{N}=\\frac{'+cnt0+'}{'+N+'}='+f(w0,4),1)}${tx('\\omega_1=\\frac{|C_1|}{N}=1-\\omega_0=\\frac{'+(N-cnt0)+'}{'+N+'}='+f(w1,4),1)}`)
  +row(4,`Inside class ${tx('C_0')} the probabilities ${tx('p_i')} only add up to ${tx('\\omega_0')}, not to 1:${tx('\\sum_{i\\le t}p_i=\\omega_0='+f(w0,4),1)}To treat class 0 as a distribution of its own we renormalise it: ${tx('P(i\\mid C_0)=\\frac{p_i}{\\omega_0}')}, which now sums to ${tx('\\frac{\\omega_0}{\\omega_0}=1')}. Class 1 is renormalised the same way with ${tx('\\omega_1')}.`)
  +row(5,`The class mean is the mean of that renormalised distribution. The sum in its numerator is the <i>partial moment</i>, the part of ${tx('\\mu_T')} that comes from the levels up to ${tx('t')}. It is not a mean yet:${tx('\\mu(t)=\\sum_{i\\le t} i\\,p_i='+f(mom,2),1)}${tx('\\mu_0=\\sum_{i\\le t} i\\,P(i\\mid C_0)=\\frac{1}{\\omega_0}\\sum_{i\\le t} i\\,p_i=\\frac{\\mu(t)}{\\omega_0}=\\frac{'+f(mom,2)+'}{'+f(w0,4)+'}='+f(mu0,2),1)}So ${tx('1/\\omega_0')} does not rescale a mean. It turns a partial sum into a mean.`)
  +row(6,`Class 1 uses the rest of the moment, because the two parts add up to the overall mean:${tx('\\mu(t)+\\sum_{i>t} i\\,p_i=\\mu_T',1)}${tx('\\mu_1=\\frac{1}{\\omega_1}\\sum_{i>t} i\\,p_i=\\frac{\\mu_T-\\mu(t)}{\\omega_1}=\\frac{'+f(o.mt,2)+'-'+f(mom,2)+'}{'+f(w1,4)+'}='+f(mu1,2),1)}As a check, ${tx('\\omega_0\\mu_0+\\omega_1\\mu_1='+f(w0*mu0+w1*mu1,2)+'=\\mu_T')}.`)
  +row(7,`Between-class variance:${tx('\\sigma_B^2(t)=\\omega_0\\,\\omega_1\\,(\\mu_0-\\mu_1)^2='+f(w0,4)+'\\times'+f(w1,4)+'\\times('+f(mu0,2)+'-'+f(mu1,2)+')^2=\\mathbf{'+f(sb,1)+'}',1)}`)
  +row(8,`Repeat for every ${tx('t')} from 0 to 255 (that is the curve above) and keep the largest:${tx('t^{*}=\\arg\\max_{0\\le t\\le 255}\\,\\sigma_B^2(t)',1)}The best candidates:<table class='dtab'><tr><th>${tx('t')}</th><th>${tx('\\sigma_B^2')}</th></tr>${ranked.map(([i,v])=>`<tr class='${i===o.bt?'hl':''}${i===t?' cur':''}'><td>${i}</td><td>${f(v,1)}</td></tr>`).join('')}</table>${ties>1?`${ties} thresholds tie for the maximum (the curve is flat there), so Otsu keeps the first one: ${tx('t^{*}='+o.bt)}.`:`The winner is ${tx('t^{*}='+o.bt)}.`}`)
  +row(9,`Why this works: the total variance does not change with ${tx('t')}:${tx('\\sigma_T^2=\\sigma_W^2+\\sigma_B^2\\quad\\Longrightarrow\\quad '+f(o.vt,1)+'='+f(o.vt-sb,1)+'+'+f(sb,1),1)}so pushing the classes as far apart as possible (large ${tx('\\sigma_B^2')}) is the same as making each class as tight as possible (small ${tx('\\sigma_W^2')}).`)
  +(t===o.bt?'':`<div class='cap' style='margin-top:8px'>You are looking at ${tx('t='+t)}. The optimum is ${tx('t^{*}='+o.bt)} with ${tx('\\sigma_B^2='+f(o.best,1))}. Press \u201cOtsu optimum\u201d to see its derivation.</div>`);
 }
}
const hooks={render:renderOtsu,paint:()=>paintOtsu()};
registerTab('otsu',hooks);
return hooks;
})();
