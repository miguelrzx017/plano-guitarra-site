/* Núcleo de áudio do afinador: notas, cents, detector YIN e análise de bends.
   Sem DOM: roda no navegador (window.GPAudio) e no Node (tests/). */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.GPAudio=factory()})(typeof self!=="undefined"?self:this,function(){
"use strict";
const SHARP=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],FLAT=["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
/* cordas da mais grave para a mais aguda, em números MIDI (E2=40, A2=45, D3=50, G3=55, B3=59, E4=64) */
const TUNINGS=[
 {id:"std",name:"Padrão (E A D G B E)",midi:[40,45,50,55,59,64]},
 {id:"dropd",name:"Drop D (D A D G B E)",midi:[38,45,50,55,59,64]},
 {id:"eb",name:"Meio tom abaixo (Eb Ab Db Gb Bb Eb)",midi:[39,44,49,54,58,63],flats:true},
 {id:"d",name:"Um tom abaixo (D G C F A D)",midi:[38,43,48,53,57,62]},
 {id:"dadgad",name:"DADGAD",midi:[38,45,50,55,57,62]},
 {id:"opg",name:"Open G (D G D G B D)",midi:[38,43,50,55,59,62]},
 {id:"s7",name:"7 cordas (B E A D G B E)",midi:[35,40,45,50,55,59,64]}
];
const INTERVALS=[{semi:1,name:"meio tom"},{semi:2,name:"um tom"},{semi:3,name:"um tom e meio"}];

const midiToFreq=(m,a4=440)=>a4*Math.pow(2,(m-69)/12);
const freqToMidi=(f,a4=440)=>69+12*Math.log2(f/a4);
/* cents = 1200 × log2(frequência_detectada / frequência_alvo) */
const cents=(f,target)=>1200*Math.log2(f/target);
const noteName=(m,flats)=>(flats?FLAT:SHARP)[((m%12)+12)%12];
const octave=m=>Math.floor(m/12)-1;
const noteLabel=(m,flats)=>noteName(m,flats)+octave(m);
function nearest(f,a4){const m=Math.round(freqToMidi(f,a4)),fr=midiToFreq(m,a4);return{midi:m,freq:fr,name:noteName(m),oct:octave(m),cents:cents(f,fr)}}
function closestString(f,tuning,a4){let b=null;tuning.midi.forEach((m,i)=>{const t=midiToFreq(m,a4),c=cents(f,t);if(!b||Math.abs(c)<Math.abs(b.cents))b={index:i,midi:m,freq:t,cents:c}});return b}
const median=a=>{if(!a.length)return NaN;const s=a.slice().sort((x,y)=>x-y),h=s.length>>1;return s.length%2?s[h]:(s[h-1]+s[h])/2};
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const sd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1))};
const pct=(a,p)=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.max(0,Math.round(p*(s.length-1))))]};

/* ---------- YIN (de Cheveigné & Kawahara, 2002) ----------
   buf: Float32Array no domínio do tempo. Devolve {ok,freq,clarity,rms} ou {ok:false,reason}.
   reason: "low" = sinal fraco demais; "noisy" = sem periodicidade clara. */
function yin(buf,sr,opt){
 const o=Object.assign({thr:0.12,fmin:55,fmax:1400,rmsMin:0.008,weak:0.30},opt||{});
 const N=buf.length;let s2=0;for(let i=0;i<N;i++)s2+=buf[i]*buf[i];
 const rms=Math.sqrt(s2/N);if(!(rms>=o.rmsMin))return{ok:false,reason:"low",rms};
 const tauMin=Math.max(2,Math.floor(sr/o.fmax)),tauMax=Math.min(Math.ceil(sr/o.fmin),(N>>1)),W=N-tauMax;
 const c=new Float32Array(tauMax+2);c[0]=1;let run=0,best=-1;
 for(let t=1;t<=tauMax;t++){
  let s=0;for(let j=0;j<W;j++){const x=buf[j]-buf[j+t];s+=x*x}
  run+=s;c[t]=run>0?s*t/run:1;
  if(best<0){if(t>=tauMin&&c[t]<o.thr)best=t}
  else{if(c[t]<c[best])best=t;else break}
 }
 let weak=false;
 if(best<0){let m=tauMin;for(let t=tauMin;t<=tauMax;t++)if(c[t]<c[m])m=t;if(c[m]>o.weak)return{ok:false,reason:"noisy",rms};best=m;weak=true}
 let tau=best;const t0=best-1,t2=best+1;
 if(t0>=1&&t2<=tauMax){const a=c[t0],b=c[best],d=c[t2],den=a-2*b+d;if(den>1e-12){const sh=(a-d)/(2*den);if(Math.abs(sh)<1)tau=best+sh}}
 const f=sr/tau;if(!(f>=o.fmin*0.9&&f<=o.fmax*1.1))return{ok:false,reason:"noisy",rms};
 return{ok:true,freq:f,clarity:Math.max(0,1-c[best]),rms,weak};
}

/* ---------- acompanhamento em tempo real ----------
   Só devolve medição quando a nota é estável; caso contrário informa por que não mediu. */
function PitchTracker(opt){
 const o=Object.assign({n:7,minClarity:0.80,spread:35,minValid:4,hold:220},opt||{});let q=[],last=null;
 return{
  push(r,now){q.push({ok:!!(r&&r.ok&&r.clarity>=o.minClarity),f:r&&r.freq,low:!!(r&&r.reason==="low"),c:r&&r.clarity,rms:r&&r.rms});if(q.length>o.n)q.shift();
   const rec=q.slice(-3);if(rec.length>=3&&rec.every(x=>x.low))return{state:"low",msg:"Sinal insuficiente: toque uma nota mais forte ou aproxime o captador do microfone."};
   const v=q.filter(x=>x.ok);
   if(v.length<o.minValid)return hold("noisy","Não consegui detectar uma nota clara. Toque uma corda solta e deixe soar.",now);
   const m=median(v.map(x=>x.f)),cs=v.map(x=>cents(x.f,m));
   if(Math.max(...cs)-Math.min(...cs)>o.spread)return hold("unstable","Nota instável: deixe a nota soar sem mexer na corda.",now);
   const r2={state:"stable",freq:m,clarity:mean(v.map(x=>x.c)),rms:mean(v.map(x=>x.rms))};last={r:r2,t:now};return r2},
  reset(){q=[];last=null}};
 function hold(state,msg,now){if(last&&now-last.t<=o.hold)return Object.assign({held:true},last.r);return{state,msg}}
}

/* ---------- análise de uma tentativa de bend ----------
   frames: [{t (ms), f (Hz)}] só com medições válidas; targetHz: nota-alvo.
   opt.tol: tolerância em cents para "afinada" (padrão 10). */
function analyzeBend(frames,targetHz,opt){
 const o=Object.assign({tol:10,minDur:300,span:60,gap:120},opt||{});
 let F=frames.filter(x=>x&&x.f>0).sort((a,b)=>a.t-b.t);
 /* descarta quadros isolados com salto de ~oitava em relação aos vizinhos (erro típico de detecção) */
 F=F.filter((x,i)=>{const nb=F.slice(Math.max(0,i-3),i+4).filter((_,j)=>j!==Math.min(i,3)).map(y=>y.f);return nb.length<3||Math.abs(cents(x.f,median(nb)))<600});
 if(F.length<8)return{ok:false,msg:"Sinal insuficiente: foram detectadas poucas medições. Toque mais forte e sustente a nota."};
 const raw=F.map(x=>cents(x.f,targetHz)),sm=raw.map((v,i)=>median(raw.slice(Math.max(0,i-1),i+2)));
 /* segmentos de altura quase constante (tolerando vibrato) */
 const segs=[];let a=0,mn=sm[0],mx=sm[0];
 const close=(i0,i1)=>{if(i1>i0&&F[i1].t-F[i0].t>=o.minDur)segs.push({i0,i1})};
 for(let i=1;i<F.length;i++){
  const brk=F[i].t-F[i-1].t>o.gap,nmn=Math.min(mn,sm[i]),nmx=Math.max(mx,sm[i]);
  if(brk||nmx-nmn>o.span){close(a,i-1);a=i;mn=mx=sm[i]}else{mn=nmn;mx=nmx}
 }
 close(a,F.length-1);
 if(!segs.length)return{ok:false,msg:"Não houve nota sustentada por pelo menos "+(o.minDur/1000).toFixed(1).replace(".",",")+" s. Chegue à altura e sustente."};
 /* o platô avaliado é o trecho sustentado mais próximo da nota-alvo (empate: o mais longo) */
 segs.forEach(s=>{s.med=median(sm.slice(s.i0,s.i1+1))});
 const P=segs.reduce((b,s)=>{const ds=Math.abs(s.med),db=Math.abs(b.med);return ds<db-1||(Math.abs(ds-db)<=1&&s.i1-s.i0>b.i1-b.i0)?s:b});
 const ts=F.slice(P.i0,P.i1+1).map(x=>x.t),xs=sm.slice(P.i0,P.i1+1),dur=ts[ts.length-1]-ts[0];
 const diff=P.med,verdict=Math.abs(diff)<=o.tol?"afinada":diff<0?"abaixo":"acima";
 const arrivalHz=targetHz*Math.pow(2,diff/1200);
 return{ok:true,verdict,diff:Math.round(diff*10)/10,arrivalHz,plateau:{t0:ts[0],t1:ts[ts.length-1],dur},tol:o.tol,stability:stability(ts,xs),
  series:downsample(F.map((x,i)=>({t:x.t,c:Math.round(sm[i]*10)/10})),140),plateauIdx:[P.i0,P.i1]};
}
function downsample(a,n){if(a.length<=n)return a;const r=[];for(let i=0;i<n;i++)r.push(a[Math.round(i*(a.length-1)/(n-1))]);return r}

/* distingue estável, deriva, vibrato provável e oscilação irregular; quando faltam evidências, diz que não sabe */
function stability(ts,xs){
 const n=xs.length,dur=ts[n-1]-ts[0];
 if(dur<500||n<10)return{kind:"insuficiente",text:"Sustentação curta demais (menos de 0,5 s) para avaliar a estabilidade. Sustente a nota por mais tempo."};
 /* tendência linear (cents/s) */
 const tm=mean(ts),xm=mean(xs);let nu=0,de=0;for(let i=0;i<n;i++){nu+=(ts[i]-tm)*(xs[i]-xm);de+=(ts[i]-tm)*(ts[i]-tm)}
 const slope=de?nu/de*1000:0,res=xs.map((x,i)=>x-(xm+slope*(ts[i]-tm)/1000));
 const p2p=pct(res,.9)-pct(res,.1),dev=sd(res);
 /* extremos com histerese */
 const h=Math.max(3,0.25*p2p),ext=[];let dir=0,ex={i:0,x:res[0]};
 for(let i=1;i<n;i++){
  if(dir>=0&&res[i]>ex.x){ex={i,x:res[i]};if(dir===0&&ex.x-res[0]>=h)dir=1}
  else if(dir<=0&&res[i]<ex.x){ex={i,x:res[i]};if(dir===0&&res[0]-ex.x>=h)dir=-1}
  if(dir===1&&ex.x-res[i]>=h){ext.push({t:ts[ex.i],x:ex.x,max:true});dir=-1;ex={i,x:res[i]}}
  else if(dir===-1&&res[i]-ex.x>=h){ext.push({t:ts[ex.i],x:ex.x,max:false});dir=1;ex={i,x:res[i]}}
 }
 const mx=ext.filter(e=>e.max),per=[];for(let i=1;i<mx.length;i++)per.push(mx[i].t-mx[i-1].t);
 const rate=per.length?1000/mean(per):0,cvP=per.length>1?sd(per)/mean(per):1;
 const out={sd:Math.round(dev*10)/10,p2p:Math.round(p2p*10)/10,slope:Math.round(slope),cycles:mx.length,rate:Math.round(rate*10)/10};
 if(Math.abs(slope)>=25&&mx.length<2)return Object.assign(out,{kind:"deriva",text:"A altura "+(slope>0?"subiu":"caiu")+" cerca de "+Math.abs(Math.round(slope))+" cents por segundo durante a sustentação. Segure a pressão do bend constante."});
 if(p2p<10)return Object.assign(out,{kind:"estavel",text:"Nota estável: variação de cerca de "+Math.round(p2p)+" cents durante a sustentação."});
 if(mx.length>=3&&rate>=3.5&&rate<=9&&cvP<0.30)return Object.assign(out,{kind:"vibrato",text:"Oscilação regular de ~"+rate.toFixed(1).replace(".",",")+" Hz e ±"+Math.round(p2p/2)+" cents: compatível com vibrato. Se não era intencional, trate como instabilidade."});
 if(mx.length>=3)return Object.assign(out,{kind:"instavel",text:"Oscilação irregular (variação de ~"+Math.round(p2p)+" cents, sem ritmo constante): provável instabilidade. Evite mexer o dedo enquanto sustenta."});
 return Object.assign(out,{kind:"incerto",text:"Houve variação de ~"+Math.round(p2p)+" cents, mas sem padrão suficiente para dizer se é vibrato ou instabilidade. Sustente mais tempo ou repita."});
}

return{SHARP,FLAT,TUNINGS,INTERVALS,midiToFreq,freqToMidi,cents,noteName,octave,noteLabel,nearest,closestString,median,mean,sd,yin,PitchTracker,analyzeBend,stability};
});
